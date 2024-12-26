import {
  BuilderContext,
  createBuilder,
  targetFromTargetString,
} from '@angular-devkit/architect';
import { normalizeOptions } from '@angular-devkit/build-angular/src/builders/dev-server/options';
import {
  serveWithVite,
  buildApplicationInternal,
} from '@angular/build/private';
import { Plugin } from 'esbuild';

import { ServeExecutorSchema } from './schema';
import { BuildExecutorSchema } from '../build/schema';
import { deepMergeObject, getMapName, loadModule, patchBuilderContext, prepareConfig } from '../helpers';
import { entryPointForExtendDependencies } from '../es-plugin';


function getBuilderAction() {
  return async function* (options, context, pluginsOrExtensions) {

    let extensions;
    if (pluginsOrExtensions && Array.isArray(pluginsOrExtensions)) {
      extensions = {
        codePlugins: pluginsOrExtensions,
      };
    } else {
      extensions = pluginsOrExtensions;
    }

    for await (const result of buildApplicationInternal(
      options,
      context,
      extensions
    )) {
      yield result;
    }
  };
}

export async function* runBuilder(
  options: ServeExecutorSchema,
  context: BuilderContext
) {
  context.logger.info('Run serve mf');

  const {mf: defaultOptionsMfe, ...defaultOptions} = options;

  const buildTarget = targetFromTargetString(options.buildTarget);
  const targetOptions = (await context.getTargetOptions(
    buildTarget
  )) as unknown as BuildExecutorSchema;

  const resultMfeOptions = deepMergeObject(
    targetOptions['mf'] || {},
    defaultOptionsMfe || {}
  );

  const optionsMfe = await prepareConfig(
    resultMfeOptions,
    targetOptions,
    context
  );

  const mapShareObject = getMapName(
    optionsMfe.shared,
    optionsMfe.sharedMappings
  );

  const externalDependencies = [...mapShareObject.values()].map(
    (i) => i.packageName
  );

  patchBuilderContext(context, buildTarget, externalDependencies);

  const normalizeOuterOptions = await normalizeOptions(
    context,
    context.target.project,
    defaultOptions
  );

  const esPluginPromise = optionsMfe.esPlugins.map((item) =>
    loadModule<Plugin>(item, targetOptions.tsConfig, context.logger)
  );
  const esPlugins = await Promise.all(esPluginPromise);

  const resultEsBuild = [
    ...esPlugins,
    entryPointForExtendDependencies(optionsMfe)
  ]

  const extensions = {
    middleware: [],
    buildPlugins: resultEsBuild,
  };

  const transforms = {
    indexHtml: async (input: string) => {
      return input;
    },
  };

  const runServer = serveWithVite(
    normalizeOuterOptions,
    '@angular-devkit/build-angular:application',
    getBuilderAction(),
    context,
    transforms,
    extensions
  );
  for await (const output of runServer) {
    yield output;
  }
}

export default createBuilder(runBuilder);
