import { writeFileSync, readFileSync } from 'fs';
// import { merge } from 'lodash';
// import { resolvePackagePath } from './packages/common/src';
import { join } from 'path';
import * as process from 'node:process';

// interface CustomSchema {
//   originalSchemaPackage?: string;
//   originalSchemaPath: string;
//   schemaExtensionPaths: string[];
//   newSchemaPath: string;
// }

const pathToDevServerSchema =
  './node_modules/@angular-devkit/build-angular/src/builders/dev-server/schema.json';
const pathToBuilderSchema =
  './node_modules/@angular/build/src/builders/application/schema.json';
const pathToNewSchema =
  './libs/nx-angular-mf/src/builders/schema/schema.json';

const pathToNewDevSchema =
  './libs/nx-angular-mf/src/builders/serve/schema.json';

const pathToNewBuilderSchema =
  './libs/nx-angular-mf/src/builders/build/schema.json';

const devServerSchema = JSON.parse(
  readFileSync(join(process.cwd(), pathToDevServerSchema), 'utf8')
);
const builderSchema = JSON.parse(
  readFileSync(join(process.cwd(), pathToBuilderSchema), 'utf8')
);

const newSchema = JSON.parse(
  readFileSync(join(process.cwd(), pathToNewSchema), 'utf8')
);


const resultDevServerSchema = {
  ...devServerSchema,
  ...{
    properties: {
      ...devServerSchema.properties,
      ...newSchema.properties,
    },
  },
};
const resultBuildSchema = {
  ...builderSchema,
  ...{
    properties: {
      ...builderSchema.properties,
      ...newSchema.properties,
    },
  },
};

writeFileSync(
  join(process.cwd(), pathToNewDevSchema),
  JSON.stringify(resultDevServerSchema, null, 2),
  'utf-8'
);
writeFileSync(
  join(process.cwd(), pathToNewBuilderSchema),
  JSON.stringify(resultBuildSchema, null, 2),
  'utf-8'
);
