import {
  DIRECTORY_FUNCTION_ROUTES,
  invokeDirectoryFunction,
} from '../../shared/directoryFunctionRouting.js';
import {
  SERVICE_CONFIGURATION_FUNCTION_ROUTES,
  invokeServiceConfigurationFunction,
} from '../../shared/serviceConfigurationFunctionRouting.js';
import {
  PROVIDER_WORKSPACE_FUNCTION_ROUTES,
  invokeProviderWorkspaceFunction,
} from '../../shared/providerWorkspaceFunctionRouting.js';
import { getBase44LatestFunctionClient } from './base44LatestFunctionClient.js';
import { withTransientRetry } from '../lib/transientRetry.js';

// 2026-10-02. Contul de furnizor porneste 6-8 functii aproape deodata (spatiu, profil profesional,
// pregatire, membri, prezentare, plan, sincronizare acces). Cand aplicatia e incarcata (cron-ul
// de import, alte sesiuni), Base44 raspunde uneori "Rate limit exceeded" (HTTP 500) si contul
// arata "Nu am putut incarca" (test E2E 2026-10-02). Functiile de mai jos DOAR CITESC date
// (verificat: niciun create/update/delete in modulele lor), deci se pot reincerca in siguranta.
// Functiile care scriu nu se reincearca automat: o eroare la jumatatea lor ar putea dubla efectul.
export const READ_ONLY_RETRY_FUNCTIONS = Object.freeze(new Set([
  'getMyProviderWorkspace',
  'getMyProfessionalWorkspace',
  'getMyProviderOnboardingWorkspace',
  'getMyProviderMembers',
  'getProviderWorkspaceOverview',
  'getProviderEntitlement',
  'getProviderLocationComparison',
  'getProviderProfileCompleteness',
  'getProviderLogoReviewStatus',
]));
// 2026-10-03. Pauze mai lungi si aleatoare: dupa „Rate limit exceeded” platforma are nevoie de
// cateva secunde, iar reincercarile simultane trebuie raspandite (inainte, 0,8 s si 2 s fixe,
// deci toate cererile cazute deodata loveau din nou limita impreuna).
export const READ_ONLY_RETRY_DELAYS_MS = Object.freeze([1500, 4000]);
export const READ_ONLY_RETRY_JITTER_MS = 1000;

// 2026-10-03. Doua cereri de citire identice (aceeasi functie, acelasi payload) pornite in timp ce
// prima inca asteapta raspuns primesc acelasi raspuns, nu un apel nou. Nu e un cache: dupa ce
// raspunsul vine, urmatoarea cerere pleaca din nou la server.
export function readOnlyRequestKey(logicalName, payload = {}) {
  try {
    return `${logicalName}:${JSON.stringify(payload ?? {})}`;
  } catch {
    return '';
  }
}

// Trebuie sa fie identica cu DIRECTORY_IMPORT_RUNTIME_REVISION din
// base44/functions/directoryOps/directoryImportOpsLatest.ts - adaptorul care raspunde
// efectiv la `runtime_info` (verificat live 2026-08-06).
// Istoric: pe 2026-07-31 s-a introdus stratul "Latest" (campanie nationala + import
// automat) cu revizie proprie, dar constanta de aici a ramas la 'read-safe-6'. Rezultat:
// handshake-ul esua si crearea unui snapshot nou din admin era blocata cu mesajul
// "Runtime-ul actual al importului nu este versiunea location-first publicata".
export const DIRECTORY_IMPORT_RUNTIME_REVISION = 'directory-import-runtime-national-directory-5';

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

  const retryOptions = options.readOnlyRetry || { delaysMs: READ_ONLY_RETRY_DELAYS_MS, jitterMs: READ_ONLY_RETRY_JITTER_MS };
  const inFlightReads = new Map();

  const routedFunctions = new Proxy(rawFunctions, {
    get(target, property) {
      if (property === 'invoke') {
        const invokeRouted = async (logicalName, payload = {}) => {
          if (DIRECTORY_FUNCTION_ROUTES[logicalName]) {
            if (logicalName === 'directoryImportOps') {
              const directoryImportClient = options.directoryImportClient
                || (typeof window === 'undefined' ? client : await getBase44LatestFunctionClient());
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
        return (logicalName, payload = {}) => {
          if (!READ_ONLY_RETRY_FUNCTIONS.has(logicalName)) return invokeRouted(logicalName, payload);
          const key = readOnlyRequestKey(logicalName, payload);
          if (key && inFlightReads.has(key)) return inFlightReads.get(key);
          const request = withTransientRetry(() => invokeRouted(logicalName, payload), retryOptions);
          if (!key) return request;
          inFlightReads.set(key, request);
          const release = () => { if (inFlightReads.get(key) === request) inFlightReads.delete(key); };
          request.then(release, release);
          return request;
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
