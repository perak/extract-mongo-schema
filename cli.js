#! /usr/bin/env node

const commandLineArgs = require('command-line-args');
const fs = require('fs');
const path = require('path');
const extractMongoSchema = require('./extract-mongo-schema');
const xlsx = require("xlsx");

const optionDefinitions = [
  { name: 'database', alias: 'd', type: String },
  { name: 'authSource', alias: 'u', type: String },
  { name: 'inputJson', alias: 'i', type: String },
  { name: 'output', alias: 'o', type: String },
  { name: 'format', alias: 'f', type: String },
  { name: 'collection', alias: 'c', type: String },
  { name: 'array', alias: 'a', type: String },
  {
    name: 'raw', alias: 'r', type: Boolean, defaultValue: false,
  },
  {
    name: 'limit', alias: 'l', type: Number, defaultValue: 100,
  },
  {
    name: 'dont-follow-fk', alias: 'n', multiple: true, type: String,
  },
  {
    name: 'include-system', alias: 's', type: Boolean, defaultValue: false,
  },
  {
    name: 'exclude-field', alias: 'e', type: String
  },
];

const args = commandLineArgs(optionDefinitions);
if(args.output !== "-") {
    console.log('');
    console.log('Extract schema from Mongo database (including foreign keys)');
}
const printUsage = function () {
  console.log('');
  console.log('Usage:');
  console.log('\textract-mongo-schema -d connection_string -o schema.json');
  console.log('\t\t-u, --authSource string\tDatabase for authentication. Example: "admin".');
  console.log('\t\t-d, --database string\tDatabase connection string. Example: "mongodb://localhost:3001/meteor".');
  console.log('\t\t-o, --output string\tOutput file Use - to output to STDOUT');
  console.log('\t\t-f, --format string\tOutput file format. Can be "json", "html-diagram" or "xlsx".');
  console.log('\t\t-i, --inputJson string\tInput JSON file, to be used instead of --database. NOTE: this will ignore the remainder of input params and use a previously generated JSON file to generate the diagram.');
  console.log('\t\t-c, --collection\tComma separated list of collections to analyze. Example: "collection1,collection2".');
  console.log('\t\t-a, --array\tComma separated list of types of arrays to analyze. Example: "Uint8Array,ArrayBuffer,Array".');
  console.log('\t\t-r, --raw\tShows the exact list of types with frequency instead of the most frequent type only.');
  console.log('\t\t-l, --limit\tChanges the amount of items to parse from the collections. Default is 100.');
  console.log('\t\t-n, --dont-follow-fk string\tDon\'t follow specified foreign key. Can be simply "fieldName" (all collections) or "collectionName:fieldName" (only for given collection).');
  console.log('\t\t-s, --include-system string\tAnalyzes system collections as well.');
  console.log('\t\t-e, --exclude-field string\tExcludes a field from being included in the output schema. Example: -e "_id".');
  console.log('');
  console.log('Enjoy! :)');
  console.log('');
};

if (args.database && args.inputJson) {
  console.log('');
  console.log('Cannot provide both database connection string and input JSON path.');
  printUsage();
  process.exit(1);
}

if (!args.database && !args.inputJson) {
  console.log('');
  console.log('Database connection string or input JSON path is missing.');
  printUsage();
  process.exit(1);
}

if (!args.output) {
  console.log('');
  console.log('Output path is missing.');
  printUsage();
  process.exit(1);
}

if (fs.existsSync(args.output)) {
  const outputStat = fs.lstatSync(args.output);

  if (outputStat.isDirectory()) {
    console.log(`Error: output "${args.output}" is not a file.`);
    process.exit(1);
  }
}

let collectionList = null;
if (args.collection) {
  collectionList = args.collection.split(',');
}

let arrayList = null;
if (args.array) {
  arrayList = args.array.split(',');
}

let fieldExclusionList = [];
if(args["exclude-field"]) {
    fieldExclusionList = args["exclude-field"].split(',');
}

const outputFormat = args.format || 'json';

const dontFollowTMP = args['dont-follow-fk'] || [];

const dontFollowFK = {
  __ANY__: {},
};

dontFollowTMP.map((df) => {
  const dfArray = df.split(':');

  let collection = '';
  let field = '';

  if (dfArray.length > 1) {
    collection = dfArray[0];
    field = dfArray[1];
  } else {
    collection = '__ANY__';
    field = dfArray[0];
  }
  dontFollowFK[collection][field] = true;
});

if(args.output !== "-") {
    console.log('');
    console.log('Extracting...');
}

const opts = {
  authSource: args.authSource,
  collectionList,
  arrayList,
  raw: args.raw,
  limit: args.limit,
  dontFollowFK,
  includeSystem: args['include-system'],
  excludeFields: fieldExclusionList
};


(async () => {
  try {
    let schema;
    if (args.inputJson) {
      // read input json
      const inputJsonPath = path.join(__dirname, args.inputJson)
      try {
        const inputJsonString = fs.readFileSync(inputJsonPath, 'utf8')
        schema = JSON.parse(inputJsonString)
      } catch (e) {
        console.log(`Error: cannot read input json file "${inputJsonPath}". ${e.message}`);
        process.exit(1);
      }
    }
    else {
      schema = await extractMongoSchema.extractMongoSchema(args.database, opts);
    }

    if (outputFormat === 'json') {
      try {
        if(args.output === "-")
            console.log(JSON.stringify(schema, null, '\t'));
        else
            fs.writeFileSync(args.output, JSON.stringify(schema, null, '\t'), 'utf8');
      } catch (e) {
        console.log(`Error: cannot write output "${args.output}". ${e.message}`);
        process.exit(1);
      }
    }

    if (outputFormat === 'html-diagram') {
      const templateFileName = path.join(__dirname, '/template-html-diagram.html');

      // read input file
      let templateHTML = '';
      try {
        templateHTML = fs.readFileSync(templateFileName, 'utf8');
      } catch (e) {
        console.log(`Error: cannot read template file "${templateFileName}". ${e.message}`);
        process.exit(1);
      }

      templateHTML = templateHTML.replace('{/*DATA_HERE*/}', JSON.stringify(schema, null, '\t'));

      try {
        fs.writeFileSync(args.output, templateHTML, 'utf8');
      } catch (e) {
        console.log(`Error: cannot write output "${args.output}". ${e.message}`);
        process.exit(1);
      }
    }
    if(outputFormat == "xlsx"){
      if(!args.output.endsWith(".xlsx")){
        console.log("Wrong output format [xlsx]");
        process.exit(1);
      }
      //get all collections
      var collections = Object.keys(schema);
      var wb = xlsx.utils.book_new();
      //one worksheet per collection
      collections.forEach(element => {
        var wsName = element;

        // console.log(element);
        var wsData = [["Collection", "primaryKey", "type", "structure", "require"]];
        var items = Object.keys(schema[element]);//items in collection        
        items.forEach( item => {                  
          var props = Object.keys(schema[element][item]);           
          var itemProperties = {          
            primaryKey: schema[element][item]["primaryKey"] != "undefined" ? schema[element][item]["primaryKey"] == "undefined" : false,
            type: schema[element][item]["type"] != "undefined" ? schema[element][item]["type"] : "undefined",
            structure: schema[element][item]["structure"] != "undefined" ? schema[element][item]["structure"] : "undefined",
            require: schema[element][item]["required"] != "undefined" ? schema[element][item]["required"] : "undefined"
          };           
          if(itemProperties.type != "undefined" && itemProperties.type == "Object"){
            itemProperties.structure = JSON.stringify(itemProperties.structure);
          }
          var data = [];
          data.push(item);
          data.push(itemProperties.primaryKey);
          data.push(itemProperties.type);
          data.push(itemProperties.structure);
          data.push(itemProperties.require);          
          wsData.push(data);        
        });
        // console.log(wsData);
        var ws = xlsx.utils.aoa_to_sheet(wsData);
        xlsx.utils.book_append_sheet(wb, ws, wsName);
      });
      xlsx.writeFile(wb, args.output);
    }
    if(args.output !== "-") {
        console.log('Success.');
        console.log('');
    }
  } catch (err) {
    console.log(err);
    process.exit(1);
  }
})();



