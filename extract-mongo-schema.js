const { MongoClient, ObjectId } = require('mongodb');

const connect = async connectionURL => new Promise((resolve, reject) => {
  const client = new MongoClient(connectionURL, { useNewUrlParser: true, useUnifiedTopology: true });
  client.connect((err) => {
    if (err) throw err;
    const db = client.db();
    return resolve({ client, db });
  });
});

const getSchema = async (url, opts) => {
  const { client, db } = await connect(url);

  const l = await db.listCollections();
  const collectionInfos = await l.toArray();
  const schema = {};
  const collections = {};
  const relations = {};
  let requests = 0;
  let cached = 0;

  const findRelatedCollection = async (value, field) => {
    const valueToString = value.toString();
    console.log('cached', cached);
    console.log('requests', requests);
    if (relations[valueToString]) {
      for (const collectionName in collections) {
        cached++;
        if (relations[valueToString].collectionName === collectionName) {
          delete field.key;
          field.foreignKey = true;
          field.references = collectionName;
        } else {
          field.key = true;
        }
      }
      return;
    }
    for (const collectionName in collections) {
      const related = await collections[collectionName].collection.findOne({ _id: ObjectId(valueToString) }, { projection: { _id: 1 } });
      requests++;
      if (related) {
        delete field.key;
        field.foreignKey = true;
        field.references = collectionName;
        relations[valueToString] = { collectionName };
      } else {
        field.key = true;
        relations[valueToString] = { collectionName: '' };
      }
    }
  };

  const setTypeName = (item) => {
    let typeName = typeof item;
    if (typeName === 'object') {
      typeName = Object.prototype.toString.call(item);
    }
    typeName = typeName.replace('[object ', '');
    typeName = typeName.replace(']', '');
    return typeName;
  };

  const getDocSchema = async (collectionName, doc, docSchema) => {
    for (const key in doc) {
      if (!docSchema[key]) {
        docSchema[key] = { types: {} };
      }

      if (!docSchema[key].types) {
        docSchema[key].types = {};
      }
      let typeName = setTypeName(doc[key]);

      if (!docSchema[key].types[typeName]) {
        docSchema[key].types[typeName] = { frequency: 0 };
      }
      docSchema[key].types[typeName].frequency++;

      if (typeName === 'Object' && ObjectId.isValid(doc[key])) {
        typeName = 'string';
        doc[key] = doc[key].toString();
      }

      if (typeName === 'string' && ObjectId.isValid(doc[key])) {
        if (key === '_id') {
          docSchema[key].primaryKey = true;
        } else {
          // only if is not already processes
          if (!docSchema[key].foreignKey || !docSchema[key].references) {
            // only if is not ignored
            if (!(opts.dontFollowFK.__ANY__[key] || (opts.dontFollowFK[collectionName] && opts.dontFollowFK[collectionName][key]))) {
              await findRelatedCollection(doc[key], docSchema[key]);
            }
          }
        }
      }

      if (typeName === 'Object') {
        if (!docSchema[key].types[typeName].structure) {
          docSchema[key].types[typeName].structure = {};
        }
        await getDocSchema(collectionName, doc[key], docSchema[key].types[typeName].structure);
      }

      if (opts.arrayList && opts.arrayList.indexOf(typeName) !== -1) {
        if (!docSchema[key].types[typeName].structure) {
          docSchema[key].types[typeName].structure = { types: {} };
        }

        if (!docSchema[key].types[typeName].structure.types) {
          docSchema[key].types[typeName].structure.types = {};
        }
        for (let i = 0; i < doc[key].length; i++) {
          const typeNameArray = setTypeName(doc[key][i]);
          if (typeNameArray === 'Object') {
            if (!docSchema[key].types[typeName].structure.types[typeNameArray]) {
              docSchema[key].types[typeName].structure.types[typeNameArray] = { structure: {} };
            }

            if (!docSchema[key].types[typeName].structure.types[typeNameArray].structure) {
              docSchema[key].types[typeName].structure.types[typeNameArray].structure = {};
            }
            await getDocSchema(collectionName, doc[key][i], docSchema[key].types[typeName].structure.types[typeNameArray].structure);
          } else {
            if (!docSchema[key].types[typeName].structure.types[typeNameArray]) {
              docSchema[key].types[typeName].structure.types[typeNameArray] = { frequency: 0 };
            }
            docSchema[key].types[typeName].structure.types[typeNameArray].frequency++;
          }
        }
      }
    }
  };

  const setMostFrequentType = (field, processed) => {
    let max = 0;
    let notNull = true;
    for (const typeName in field.types) {
      if (typeName === 'Null') {
        notNull = false;
      }
      field.types[typeName].frequency = field.types[typeName].frequency / processed;
      if (field.types[typeName].frequency > max) {
        max = field.types[typeName].frequency;
        if (typeName !== 'undefined' && typeName !== 'Null') {
          field.type = typeName;
        }
      }
    }
    return notNull;
  };

  const mostFrequentType = (docSchema, processed) => {
    if (processed) {
      for (const fieldName in docSchema) {
        if (docSchema[fieldName]) {
          let notNull = setMostFrequentType(docSchema[fieldName], processed);
          if (!docSchema[fieldName].type) {
            docSchema[fieldName].type = 'undefined';
            notNull = false;
          }

          const dataType = docSchema[fieldName].type;
          if (dataType === 'Object') {
            mostFrequentType(docSchema[fieldName].types[dataType].structure, processed);
            docSchema[fieldName].structure = docSchema[fieldName].types[dataType].structure;
          }

          if (opts.arrayList && opts.arrayList.indexOf(dataType) !== -1) {
            if (Object.keys(docSchema[fieldName].types[dataType].structure.types)[0] === 'Object') {
              mostFrequentType(docSchema[fieldName].types[dataType].structure.types.Object.structure, processed);
              docSchema[fieldName].types[dataType].structure.type = 'Object';
              docSchema[fieldName].types[dataType].structure.structure = docSchema[fieldName].types[dataType].structure.types.Object.structure;
              delete docSchema[fieldName].types[dataType].structure.types;
            } else {
              mostFrequentType(docSchema[fieldName].types[dataType], processed);
            }
            docSchema[fieldName].structure = docSchema[fieldName].types[dataType].structure;
          }

          delete docSchema[fieldName].types;

          docSchema[fieldName].required = notNull;
        }
      }
    }
  };

  if (opts.collectionList !== null) {
    for (let i = collectionInfos.length - 1; i >= 0; i--) {
      if (opts.collectionList.indexOf(collectionInfos[i].name) === -1) {
        collectionInfos.splice(i, 1);
      }
    }
  }

  await Promise.all(collectionInfos.map(async (collectionInfo, index) => {
    collections[collectionInfo.name] = {};
    schema[collectionInfo.name] = {};
    collections[collectionInfo.name].collection = await db.collection(collectionInfo.name);
    const docs = await collections[collectionInfo.name].collection.find({}, { limit: opts.limit }).toArray();
    await Promise.all(docs.map(async doc => await getDocSchema(collectionInfo.name, doc, schema[collectionInfo.name])));
    if (!opts.raw) mostFrequentType(schema[collectionInfo.name], docs.length);
  }));

  await client.close();
  return schema;
};

const extractMongoSchema = async (url, opts) => getSchema(url, opts);


if (typeof module !== 'undefined' && module.exports) {
  module.exports.extractMongoSchema = extractMongoSchema;
} else {
  this.extractMongoSchema = extractMongoSchema;
}
