var MongoClient = require('mongodb').MongoClient;
var wait = require("wait.for");

var getSchema = function(url, collectionList, arrayList, raw) {
	var db = wait.forMethod(MongoClient, "connect", url);

	var l = db.listCollections();
	var collectionInfos = wait.forMethod(l, "toArray");
	var schema = {};
	var collections = {};

	var findRelatedCollection = function(value, field) {
		for(var collectionName in collections) {
			var related = wait.forMethod(collections[collectionName].collection, "findOne", { _id: value });
			if(related) {
				delete field["key"];
				field["foreignKey"] = true;
				field["references"] = collectionName;
			} else {
				field["key"] = true;
			}
		}
	};

	var setTypeName = function(item) {
		var typeName = typeof item;
		if(typeName === "object") {
			typeName = Object.prototype.toString.call(item);
		}

		typeName = typeName.replace("[object ", "");
		typeName = typeName.replace("]", "");
		return typeName;
	};

	var getDocSchema = function(doc, docSchema) {
		for(var key in doc) {
			if(!docSchema[key]) {
				docSchema[key] = { "types": {} };
			}

			if(!docSchema[key]["types"]) {
				docSchema[key]["types"] = {};
			}

			var typeName = setTypeName(doc[key]);

			if(!docSchema[key]["types"][typeName]) {
				docSchema[key]["types"][typeName] = { frequency: 0 };
			}
			docSchema[key]["types"][typeName]["frequency"]++;

			if(typeName == "string" && /^[23456789ABCDEFGHJKLMNPQRSTWXYZabcdefghijkmnopqrstuvwxyz]{17}$/.test(doc[key])) {
				if(key == "_id") {
					docSchema[key]["primaryKey"] = true;
				} else {
					if(!docSchema[key]["foreignKey"] || !docSchema[key]["references"]) {
						findRelatedCollection(doc[key], docSchema[key]);
					}
				}
			}

			if(typeName == "Object") {
				docSchema[key]["types"][typeName]["structure"] = {};
				getDocSchema(doc[key], docSchema[key]["types"][typeName]["structure"]);
			}

			if(arrayList && arrayList.indexOf(typeName) !== -1) {
				docSchema[key]["types"][typeName]["structure"] = {};
				docSchema[key]["types"][typeName]["structure"]["types"] = {}
				for(var i = 0; i < doc[key].length; i++) {
					var typeNameArray = setTypeName(doc[key][i]);
					if(typeNameArray === "Object") {
						docSchema[key]["types"][typeName]["structure"]["types"][typeNameArray] = {}
						docSchema[key]["types"][typeName]["structure"]["types"][typeNameArray]["structure"] = {}
						getDocSchema(doc[key][i], docSchema[key]["types"][typeName]["structure"]["types"][typeNameArray]["structure"]);
					} else {
						docSchema[key]["types"][typeName]["structure"]["types"][typeNameArray] = { frequency: 1 };						
					}
				}
			}
		}
	};

	var setMostFrequentType = function(field, processed) {
		var max = 0;
		var notNull = true;
		for(var typeName in field["types"]) {
			if(typeName == "Null") {
				notNull = false;
			}
			field["types"][typeName]["frequency"] = field["types"][typeName]["frequency"] / processed;
			if(field["types"][typeName]["frequency"] > max) {
				max = field["types"][typeName]["frequency"];
				if(typeName != "undefined" && typeName != "Null") {
					field["type"] = typeName;
				}
			}
		}
		return notNull;
	}

	var mostFrequentType = function(docSchema, processed) {
		if(processed) {
			for(var fieldName in docSchema) {
				if(docSchema[fieldName]) {
					var notNull = setMostFrequentType(docSchema[fieldName], processed);
					if(!docSchema[fieldName]["type"]) {
						docSchema[fieldName]["type"] = "undefined";
						notNull = false;
					}

					var dataType = docSchema[fieldName]["type"];
					if(dataType == "Object") {
						mostFrequentType(docSchema[fieldName]["types"][dataType]["structure"], processed);
						docSchema[fieldName]["structure"] = docSchema[fieldName]["types"][dataType]["structure"];
					}
					if(arrayList && arrayList.indexOf(dataType) !== -1) {
						if(Object.keys(docSchema[fieldName]["types"][dataType]["structure"]["types"])[0] == "Object") {
							mostFrequentType(docSchema[fieldName]["types"][dataType]["structure"]["types"]["Object"]["structure"], processed);
							docSchema[fieldName]["types"][dataType]["structure"]["type"] = "Object";
							docSchema[fieldName]["types"][dataType]["structure"]["structure"] = docSchema[fieldName]["types"][dataType]["structure"]["types"]["Object"]["structure"];
							delete docSchema[fieldName]["types"][dataType]["structure"]["types"];
						} else {
							mostFrequentType(docSchema[fieldName]["types"][dataType], processed);
						}
						docSchema[fieldName]["structure"] = docSchema[fieldName]["types"][dataType]["structure"];
					}
					delete docSchema[fieldName]["types"];

					docSchema[fieldName]["required"] = notNull;
				}
			}
		}
	};
        
	if(collectionList != null) {
		for(var i = collectionInfos.length - 1; i >= 0; i--) {
			if(collectionList.indexOf(collectionInfos[i].name) == -1) {
				collectionInfos.splice(i, 1);
			}
		}
	}

	collectionInfos.map(function(collectionInfo, index) {
		var collectionData = {};
		collections[collectionInfo.name] = collectionData;
		collectionData["collection"] = db.collection(collectionInfo.name);
	});

	collectionInfos.map(function(collectionInfo, index) {
		collectionData = collections[collectionInfo.name];
		var docSchema = {};
		schema[collectionInfo.name] = docSchema;
		var cur = wait.forMethod(collectionData["collection"], "find", {}, { limit: 100 });
		var docs = wait.forMethod(cur, "toArray");
		docs.map(function(doc) {
			getDocSchema(doc, docSchema);
		});
		if(!raw) {
			mostFrequentType(docSchema, docs.length);
		}
	});

	db.close();
	return schema;
};


var printSchema = function(url, collectionList, arrayList, raw, cb) {
	var schema = null;
	try {
		var schema = getSchema(url, collectionList, arrayList, raw);
	} catch(err) {
		if(cb) {
			cb(err, null);
		} else {
			console.log(err);
		}
		return;	
	}

	if(cb) {
		cb(null, schema);
	}

	return schema;
};

var extractMongoSchema = function(url, collectionList, arrayList, raw, cb) {
	wait.launchFiber(printSchema, url, collectionList, arrayList, raw, cb);
};


if(typeof module != "undefined" && module.exports) {
  module.exports.extractMongoSchema = extractMongoSchema;
} else {
	this.extractMongoSchema = extractMongoSchema;
}
