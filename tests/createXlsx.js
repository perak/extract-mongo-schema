const xlsx = require("xlsx");

var wb = xlsx.utils.book_new();
var wsName = "SheetJS";
var wsData = [["a", "b", "c"], ["1", "2", "3"]];
var ws = xlsx.utils.aoa_to_sheet(wsData);
xlsx.utils.book_append_sheet(wb, ws, wsName);
xlsx.writeFile(wb, "out.xlsx");