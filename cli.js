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
  { name: "dont-follow-fk", alias: "n", multiple: true, type: String }
];

const args = commandLineArgs(optionDefinitions);

console.log("");
console.log("Extract schema from Mongo database (including foreign keys)");

var printUsage = function() {
	console.log("");
	console.log("Usage:");
	console.log("\textract-mongo-schema -d connection_string -o schema.json");
	console.log("\t\t-d, --database string\tDatabase connection string. Example: \"mongodb://localhost:3001/meteor\".");
	console.log("\t\t-o, --output string\tOutput file");
	console.log("\t\t-f, --format string\tOutput file format. Can be \"json\" or \"html-diagram\".");
	console.log("\t\t-n, --dont-follow-fk string\tDon't follow specified foreign key. Can be simply \"fieldName\" (all collections) or \"collectionName:fieldName\" (only for given collection).");
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

var outputFormat = args.format || "json";

var dontFollowTMP = args["dont-follow-fk"] || [];

var dontFollowFK = { 
	__ANY__: {}
};

dontFollowTMP.map(function(df) {
	var dfArray = df.split(":");

	var collection = "";
	var field = "";

	if(dfArray.length > 1) {
		collection = dfArray[0];
		field = dfArray[1];
	} else {
		collection = "__ANY__";
		field = dfArray[0];
	}
	dontFollowFK[collection][field] = true;
});

console.log("");
console.log("Extracting...");

var opts = {
	dontFollowFK: dontFollowFK
};

extractMongoSchema.extractMongoSchema(args.database, opts, function(err, schema) {
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
