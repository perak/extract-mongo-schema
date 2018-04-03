#! /usr/bin/env node

const commandLineArgs = require("command-line-args");
const fs = require("fs");
const path = require("path");
const replaceExt = require("replace-ext");
const extractMongoSchema = require("./extract-mongo-schema");

const optionDefinitions = [
  { name: "database", alias: "d", type: String },
  { name: "output", alias: "o", type: String },
  { name: "format", alias: "f", type: String },
  { name: "collection", alias: "c", type: String },
  { name: "array", alias: "a", type: String },
  { name: "raw", alias: "r", type: Boolean, defaultValue: false }
];

const args = commandLineArgs(optionDefinitions);

console.log("");
console.log("Extract schema from Mongo database (including foreign keys)");

var printUsage = function() {
	console.log("");
	console.log("Usage:");
	console.log("\textract-mongo-schema -d connection_string -o schema.json");
	console.log("\t\t-d, --database\tDatabase connection string. Example: \"mongodb://localhost:3001/meteor\".");
	console.log("\t\t-o, --output\tOutput file");
	console.log("\t\t-f, --format\tOutput file format. Can be \"json\" or \"html-diagram\".");
        console.log("\t\t-c, --collection\tComma separated list of collections to analyze. Example: \"collection1,collection2\".");
        console.log("\t\t-a, --array\tComma separated list of types of arrays to analyze. Example: \"Uint8Array,ArrayBuffer,Array\".");
	console.log("\t\t-r, --raw\tShows the exact list of types with frequency instead of the most frequent type only.");
	console.log("");
	console.log("Enjoy! :)");
	console.log("");
};

if(!args.database) {
	console.log("");
	console.log("Database connection string is missing.");
	printUsage();
	process.exit(1);
}

if(!args.output) {
	console.log("");
	console.log("Output path is missing.");
	printUsage();
	process.exit(1);
}

if(fs.existsSync(args.output)) {
	var outputStat = fs.lstatSync(args.output);

	if(outputStat.isDirectory()) {
		console.log("Error: output \"" + args.output + "\" is not a file.");
		process.exit(1);
	}
}

var collectionList = null;
if(args.collection) {
	collectionList = args.collection.split(",");
}

var arrayList = null;
if(args.array) {
	arrayList = args.array.split(",");
}

var outputFormat = args.format || "json";


console.log("");
console.log("Extracting...");
extractMongoSchema.extractMongoSchema(args.database, collectionList, arrayList, args.raw, function(err, schema) {
	if(err) {
		console.log(err);
		process.exit(1);
	}

	if(outputFormat === "json") {
		try {
			fs.writeFileSync(args.output, JSON.stringify(schema, null, "\t"), "utf8");
		} catch(e) {
			console.log("Error: cannot write output \"" + args.output + "\". " + e.message);
			process.exit(1);
		}
	}

	if(outputFormat === "html-diagram") {
		var templateFileName = path.join(__dirname, "/template-html-diagram.html");

		// read input file
		var templateHTML = "";
		try {
			templateHTML = fs.readFileSync(templateFileName, "utf8");
		} catch(e) {
			console.log("Error: cannot read template file \"" + templateFileName + "\". " + e.message);
			process.exit(1);
		}

		templateHTML = templateHTML.replace("{/*DATA_HERE*/}", JSON.stringify(schema, null, "\t"));

		try {
			fs.writeFileSync(args.output, templateHTML, "utf8");
		} catch(e) {
			console.log("Error: cannot write output \"" + args.output + "\". " + e.message);
			process.exit(1);
		}
	}


	console.log("Success.");
	console.log("");
});
