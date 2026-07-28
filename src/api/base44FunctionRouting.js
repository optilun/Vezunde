import {
  DIRECTORY_FUNCTION_ROUTES,
  invokeDirectoryFunction,
} from '../../base44/shared/directoryFunctionRouting.js';
import {
  SERVICE_CONFIGURATION_FUNCTION_ROUTES,
  invokeServiceConfigurationFunction,
} from '../../base44/shared/serviceConfigurationFunctionRouting.js';
import {
  PROVIDER_WORKSPACE_FUNCTION_ROUTES,
  invokeProviderWorkspaceFunction,
} from '../../base44/shared/providerWorkspaceFunctionRouting.js';
import { getBase44LatestFunctionClient } from './base44LatestFunctionClient.js';

export const DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-latest-1';

const directoryImportRuntimeChecks = new WeakMap();

function responseData(response) {
  return response?.data ?? response ?? {};
}

function verifyDirectoryImportRuntime(client) {
  const existing = directoryImportRuntimeChecks.get(client);
  if (existing) return existing;

  const check = invokeDirectoryFunction(client, 'directoryImportOps', { action: 'runtime_info' })
    .then((response) => {
      const data = responseData(response);
      if (data.runtime_revision !== DIRECTORY_IMPORT_RUNTIME_REVISION) {
        throw new Error('Runtime-ul actual al importului nu este versiunea location-first publicata. Reincarca aplicatia dupa publicare.');
      }
      return true;
    })
    .catch((error) => {
      directoryImportRuntimeChecks.delete(client);
      throw error;
    });

  directoryImportRuntimeChecks.set(client, check);
  return check;
}

export function installBase44FunctionRouting(client, options = {}) {
  const rawFunctions = client.functions;
  const rawInvoke = rawFunctions.invoke.bind(rawFunctions);
  const directoryImportClient = options.directoryImportClient
    || (typeof window === 'undefined' ? client : getBase44LatestFunctionClient());

  const routedFunctions = new Proxy(rawFunctions, {
    get(target, property) {
      if (property === 'invoke') {
        return async (logicalName, payload = {}) => {
          if (DIRECTORY_FUNCTION_ROUTES[logicalName]) {
            if (logicalName === 'directoryImportOps') {
              if (payload?.action === 'create_snapshot') {
                await verifyDirectoryImportRuntime(directoryImportClient);
              }
              return invokeDirectoryFunction(directoryImportClient, logicalName, payload);
            }
            return invokeDirectoryFunction(client, logicalName, payload);
          }
          if (SERVICE_CONFIGURATION_FUNCTION_ROUTES[logicalName]) {
            return invokeServiceConfigurationFunction(client, logicalName, payload);
          }
          if (PROVIDER_WORKSPACE_FUNCTION_ROUTES[logicalName]) {
            return invokeProviderWorkspaceFunction(client, logicalName, payload);
          }
          return rawInvoke(logicalName, payload);
        };
      }
      return Reflect.get(target, property, target);
    },
  });

  return new Proxy(client, {
    get(target, property) {
      if (property === 'functions') return routedFunctions;
      return Reflect.get(target, property, target);
    },
  });
}
