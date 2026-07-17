import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { appParams } from "@/lib/app-params";

const AuthContext = createContext();

function clearStoredAccessToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("base44_access_token");
    window.localStorage.removeItem("token");
  }
  appParams.token = null;
}

function isExpiredJwt(token) {
  try {
    const payloadPart = String(token || "").split(".")[1];
    if (!payloadPart || typeof window === "undefined") return false;
    const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(window.atob(padded));
    if (!Number.isFinite(Number(payload?.exp))) return false;
    return Number(payload.exp) * 1000 <= Date.now() + 30000;
  } catch (_error) {
    return false;
  }
}

if (appParams.token && isExpiredJwt(appParams.token)) {
  clearStoredAccessToken();
}

const hasInitialToken = Boolean(appParams.token);

const loadBase44 = async () => {
  const { base44 } = await import("@/api/base44Client");
  return base44;
};

const loadPublicSettings = async () => {
  const headers = new Headers({
    "X-App-Id": appParams.appId,
  });

  if (appParams.token) {
    headers.set("Authorization", `Bearer ${appParams.token}`);
  }

  const response = await fetch(
    `/api/apps/public/prod/public-settings/by-id/${appParams.appId}`,
    {
      credentials: "same-origin",
      headers,
    },
  );
  const data = await response.json().catch(() => null);

  if (!response.ok) {
    throw Object.assign(
      new Error(
        data?.message || `Public settings request failed with ${response.status}`,
      ),
      {
        status: response.status,
        data,
      },
    );
  }

  return data;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoadingAuth, setIsLoadingAuth] = useState(hasInitialToken);
  const [isLoadingPublicSettings, setIsLoadingPublicSettings] = useState(true);
  const [authError, setAuthError] = useState(null);
  const [authChecked, setAuthChecked] = useState(!hasInitialToken);
  const [appPublicSettings, setAppPublicSettings] = useState(null);

  const checkUserAuth = useCallback(async () => {
    if (!appParams.token) {
      setUser(null);
      setIsAuthenticated(false);
      setIsLoadingAuth(false);
      setAuthChecked(true);
      return;
    }

    try {
      setIsLoadingAuth(true);
      const base44 = await loadBase44();
      const currentUser = await base44.auth.me();
      setUser(currentUser || null);
      setIsAuthenticated(Boolean(currentUser));
    } catch (error) {
      setUser(null);
      setIsAuthenticated(false);

      if (error.status === 401 || error.status === 403) {
        clearStoredAccessToken();
      } else {
        console.error("User auth check failed:", error);
        setAuthError({
          type: "unknown",
          message: error.message || "Failed to verify authentication",
        });
      }
    } finally {
      setIsLoadingAuth(false);
      setAuthChecked(true);
    }
  }, []);

  const checkAppState = useCallback(async () => {
    setIsLoadingPublicSettings(true);
    setAuthError(null);

    const authPromise = checkUserAuth();

    try {
      const publicSettings = await loadPublicSettings();
      setAppPublicSettings(publicSettings);
    } catch (appError) {
      console.error("App state check failed:", appError);

      if (appError.status === 403 && appError.data?.extra_data?.reason) {
        const reason = appError.data.extra_data.reason;
        if (reason === "auth_required") {
          setAuthError({
            type: "auth_required",
            message: "Authentication required",
          });
        } else if (reason === "user_not_registered") {
          setAuthError({
            type: "user_not_registered",
            message: "User not registered for this app",
          });
        } else {
          setAuthError({
            type: reason,
            message: appError.message,
          });
        }
      } else {
        setAuthError({
          type: "unknown",
          message: appError.message || "Failed to load app",
        });
      }
    } finally {
      setIsLoadingPublicSettings(false);
      await authPromise;
    }
  }, [checkUserAuth]);

  useEffect(() => {
    void checkAppState();
  }, [checkAppState]);

  const logout = useCallback(async (shouldRedirect = true) => {
    setUser(null);
    setIsAuthenticated(false);
    const base44 = await loadBase44();

    if (shouldRedirect) {
      base44.auth.logout(window.location.href);
    } else {
      base44.auth.logout();
    }
  }, []);

  const navigateToLogin = useCallback(async (returnUrl = window.location.href) => {
    const base44 = await loadBase44();
    base44.auth.redirectToLogin(returnUrl);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoadingAuth,
        isLoadingPublicSettings,
        authError,
        appPublicSettings,
        authChecked,
        logout,
        navigateToLogin,
        checkUserAuth,
        checkAppState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
