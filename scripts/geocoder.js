/* A toolbox for google app script */

const START_ROW = 2;
const LOCATION_COL = 9;
const LATITUDE_COL = 10;
const LONGITUDE_COL = 11;

/**
 * 在 Google 試算表上方選單建立一個自訂按鈕
 */
function onOpen() {
  var ui = SpreadsheetApp.getUi();
  ui.createMenu('旅遊地圖工具')
    .addItem('將B欄轉換為直連圖床', 'convertDriveLinksToThumbnails')
    .addItem('將I欄轉換為經緯度填入JK欄', 'convertLocationsToLatLng')
    .addItem('計算JK欄座標的橢圓形範圍', 'getLocationsRangeEllipse')
    .addToUi();
}

/**
 * 批次讀取 I 欄，並將經緯度數值寫入 J 欄與 K 欄
 */
function convertLocationsToLatLng() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  // 1. 自動偵測目前工作表最後一行有資料的是哪一列
  var lastRow = sheet.getLastRow();
  
  // 2. 讀取 I 到最後一行的所有地點資料 (欄位 9 代表 I 欄)
  // getValues() 會回傳一個二維陣列
  var locationRange = sheet.getRange(START_ROW, LOCATION_COL, lastRow - START_ROW + 1, 3);
  var locations = locationRange.getValues();
  
  var count = 0;
  
  // 3. 開始依序轉換每一個地點
  for (var i = 0; i < locations.length; i++) {
    var address = locations[i][0];
    
    // 如果格子是空的，就跳過
    if (!address || locations[i][1] || locations[i][2]) {
      continue;
    }
    
    try {
      // 呼叫 Google 地圖 API
      var response = Maps.newGeocoder().geocode(address);
      
      if (response.status == 'OK' && response.results.length > 0) {
        var location = response.results[0].geometry.location;
        
        // 💡 直接「即時寫回」該列的 J 欄和 K 欄
        // row 參數計算方式：基礎第 4 列 + 目前索引 i
        sheet.getRange(START_ROW + i, LATITUDE_COL).setValue(location.lat);
        sheet.getRange(START_ROW + i, LONGITUDE_COL).setValue(location.lng);
        count++;
      } else {
        sheet.getRange(START_ROW + i, LATITUDE_COL).setValue("Location not found");
        sheet.getRange(START_ROW + i, LONGITUDE_COL).setValue("Location not found");
      }
    } catch (error) {
      sheet.getRange(START_ROW + i, LATITUDE_COL).setValue("ERROR");
      sheet.getRange(START_ROW + i, LONGITUDE_COL).setValue("ERROR");
    }
    
    // 為了防止呼叫 API 速度太快被 Google 封鎖，每次循環微幅暫停 0.1 秒
    Utilities.sleep(100);
  }
  
  SpreadsheetApp.getActiveSpreadsheet().toast('已成功將 ' + count + ' 筆地點轉換為固定的經緯度數值。', 'Notification', 5);
}
/**
 * 批次將 B 欄的 Google Drive 分享網址轉換為縮圖直連網址
 */
function convertDriveLinksToThumbnails() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  var lastRow = sheet.getLastRow();
  
  // 讀取 B 欄所有資料 (從第 2 列開始，第 2 欄代表 B 欄，讀取到最後一行)
  var range = sheet.getRange(2, 2, lastRow - 1, 1);
  var values = range.getValues();
  
  var count = 0; // 用來記錄轉換了幾筆
  
  // 正規表達式：用來精準比對並抓取 /d/ 後面的檔案 ID
  // 支援包含 view?usp=drive_link 或 view?usp=sharing 等常見格式
  var driveRegex = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)\/view\S*/g;

  for (var i = 0; i < values.length; i++) {
    var v = values[i][0].toString();
    
    if (v) {
      // 🎯 關鍵修改 2：使用 .replace() 搭配動態回呼函式（Callback）
      // 這會掃描儲存格內的所有文字，一旦抓到符合的 Drive 連結，就只把該連結替換掉
      v = v.replace(driveRegex, function(match, fileId) {
        try {
          var file = DriveApp.getFileById(fileId);
          var mimeType = file.getMimeType(); // 例如 "image/jpeg" 或 "video/mp4"
          
          // 1. 判斷是否為圖片 (MimeType 開頭為 image/)
          if (mimeType.indexOf("image/") === 0) {
            count++;
            // 回傳縮圖網址（這會在前端被 <a><img src="..."></a> 使用）
            return "drive.google.com/thumbnail?id=" + fileId + "&sz=w1000";
          } 
          
          // 2. 判斷是否為影片 (MimeType 開頭為 video/)
          else if (mimeType.indexOf("video/") === 0) {
            count++;
            // 💡 影片改回傳 Google Drive 影片串流預覽網址（這在前端通常會用 <iframe> 載入）
            return "drive.google.com/file/d/" + fileId + "/preview";
          }
          
          // 3. 如果都不是（例如 PDF 或一般檔案），就保留原分享連結
          return match;
          
        } catch (e) {
          // 防錯機制：如果該檔案 ID 已經不存在，或是沒有讀取權限，就保持原網址不變
          SpreadsheetApp.getActiveSpreadsheet().toast("無法讀取檔案 ID: " + fileId + "，錯誤原因: " + e.message);
          return match; 
        }
      });
      
      // 將替換完畢（或沒符合、維持原樣）的內容塞回陣列
      values[i][0] = v;
    }
  }
  
  // 如果有成功轉換，再一口氣寫回試算表，效率最高
  if (count > 0) {
    range.setValues(values);
    SpreadsheetApp.getActiveSpreadsheet().toast('已成功將 B 欄中 ' + count + ' 筆網址轉換為直連圖床格式。', 'Notification', 5);
  } else {
    SpreadsheetApp.getActiveSpreadsheet().toast('檢查完畢！沒有發現需要轉換的 Google Drive 分享網址。', 'Notification', 5);
  }
}

function getLocationsRangeEllipse() {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName('Journey');
  var lastRow = sheet.getLastRow();
  var range = sheet.getRange(2, 4, lastRow - 1, 6);
  var value = range.getValues();

  for (var i = 0; i < value.length; i++) {
    /* No sheet name to reference */
    if (!value[i][0]) {
      continue;
    }
  
    let ellipse = calcEllipseRange(value[i][0]);
    /* Convert failed */
    if (ellipse == null) {
      continue;
    }
    value[i][1] = ellipse[0];
    value[i][2] = ellipse[1];
    value[i][3] = ellipse[2];
    value[i][4] = ellipse[3];
    value[i][5] = ellipse[4];
  }
  range.setValues(value);
  SpreadsheetApp.getActiveSpreadsheet().toast('轉換完成！');
}

function calcEllipseRange(sheetName) {
  var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
  var lastRow = sheet.getLastRow();
  var latitudes = sheet.getRange(2, LATITUDE_COL, lastRow - 1, 1).getValues();
  var longitudes = sheet.getRange(2, LONGITUDE_COL, lastRow - 1, 1).getValues();
  var n = 0, centerLat = 0, centerLng = 0, centerMetersX = 0, centerMetersY = 0;
  var projectedPoints = [];

  for (var i = 0; i < latitudes.length; i++) {
    let lat = parseFloat(latitudes[i]);
    let lng = parseFloat(longitudes[i]);
    if (isNaN(lat) || isNaN(lng)) {
      continue;
    }
    n++;
    centerLat += lat;
    centerLng += lng;

    const r_major = 6378137.0; // Earch equatorial radius (meters)
    const x = r_major * (longitudes[i] * Math.PI / 180);
    const y = r_major * Math.log(Math.tan((90 + latitudes[i]) * Math.PI / 360));

    projectedPoints.push([x, y]);
    centerMetersX += x;
    centerMetersY += y;
  }

  if (n == 0) {
    return ['ERROR: No location point.', '', '', '', ''];
  }

  centerLat = centerLat / n;
  centerLng = centerLng / n;
  centerMetersX = centerMetersX / n;
  centerMetersY = centerMetersY / n;

  let a_val = 0, b_val = 0, c_val = 0;
  projectedPoints.forEach(p => {
    const dx = p[0] - centerMetersX;
    const dy = p[1] - centerMetersY;
    a_val += dx * dx; 
    b_val += dx * dy; 
    c_val += dy * dy;
  });

  const chi_square_distr = 1.5; // 67% Confidence Interval
  const angle = Math.atan2(2 * b_val/n, a_val/n - c_val/n) / 2;
  const radiusX_meters = Math.sqrt((a_val/n + c_val/n + Math.sqrt(Math.pow(a_val/n - c_val/n, 2) + 4 * Math.pow(b_val/n, 2))) / 2) * chi_square_distr;
  const radiusY_meters = Math.sqrt((a_val/n + c_val/n - Math.sqrt(Math.pow(a_val/n - c_val/n, 2) + 4 * Math.pow(b_val/n, 2))) / 2) * chi_square_distr;
  const angle_degrees = -(angle * 180 / Math.PI);

  return [centerLat, centerLng, radiusX_meters, radiusY_meters, angle_degrees];
}


/*
    <script src="https://cdn.jsdelivr.net/npm/@turf/turf@6/turf.min.js"></script>
    var turfPoints = [];
    turfPoints.push(turf.point([lon, lat]));
    
    var featureCollection = turf.featureCollection(turfPoints);

    var hull = turf.convex(featureCollection);
    var smoothedHull = turf.buffer(hull, 5, { units: 'kilometers' });

    L.geoJSON(smoothedHull, {
      style: {
        color: '#3388ff',
        weight: 0,
        fillColor: '#3388ff',
        fillOpacity: 0.2,
        lineJoin: 'round'
      }
    }).addTo(map);
*/

/*
    var points = [];
    points.push([lat, lon]);
    
    const n = points.length;
    let centerX = 0, centerY = 0;
    let projectedPoints = [];
    points.forEach(p => {
      centerX += p[0] / n;
      centerY += p[1] / n;
      let latLng = L.latLng(p[0], p[1]);
      let pointMeter = map.options.crs.project(latLng);
      projectedPoints.push([pointMeter.x, pointMeter.y]);
    });

    let sumX = 0, sumY = 0;
    projectedPoints.forEach(p => { sumX += p[0]; sumY += p[1]; });
    const centerMetersX = sumX / n;
    const centerMetersY = sumY / n;

    let a_val = 0, b_val = 0, c_val = 0;
    projectedPoints.forEach(p => {
        const dx = p[0] - centerMetersX;
        const dy = p[1] - centerMetersY;
        a_val += dx * dx; 
        b_val += dx * dy; 
        c_val += dy * dy;
    });

    const chi_square_distr = 1.7941; // 80% Confidence Interval
    const angle = Math.atan2(2 * b_val/n, a_val/n - c_val/n) / 2;
    const radiusX_meters = Math.sqrt((a_val/n + c_val/n + Math.sqrt(Math.pow(a_val/n - c_val/n, 2) + 4 * Math.pow(b_val/n, 2))) / 2) * chi_square_distr;
    const radiusY_meters = Math.sqrt((a_val/n + c_val/n - Math.sqrt(Math.pow(a_val/n - c_val/n, 2) + 4 * Math.pow(b_val/n, 2))) / 2) * chi_square_distr;
    const angle_degrees = -(angle * 180 / Math.PI);
  
    L.ellipse([centerX, centerY], [radiusX_meters, radiusY_meters], angle_degrees, {
        color: '#3388ff',
        weight: 2,
        fillColor: '#3388ff',
        fillOpacity: 0.15
      }
    ).addTo(map);
*/