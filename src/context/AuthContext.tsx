import { XMON_API_URL } from "@/config";
import * as SecureStore from "expo-secure-store";
import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

type AuthUser = {
  id: string;
  email: string;
  username: string;
  created_at?: string;
};

type AuthResponse = {
  user: AuthUser;
  access_token: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (
    email: string,
    password: string,
    username: string,
  ) => Promise<void>;
  logout: () => Promise<void>;
  updateUsername: (username: string) => Promise<AuthUser>;
  deleteAccount: () => Promise<void>;
  checkUsernameAvailability: (username: string) => Promise<boolean>;
};

const TOKEN_KEY = "xmon.auth.accessToken";
const USER_KEY = "xmon.auth.user";
const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function requestAuth(
  path: "login" | "signup",
  email: string,
  password: string,
  username?: string,
) {
  const response = await fetch(`${XMON_API_URL}/api/auth/${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password, username }),
  });

  const data = (await response.json().catch(() => null)) as
    | (Partial<AuthResponse> & { message?: string })
    | null;

  if (!response.ok || !data?.access_token || !data.user) {
    throw new Error(
      data?.message ?? "Authentication failed. Please try again.",
    );
  }

  return data as AuthResponse;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    async function hydrateAuth() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(USER_KEY),
        ]);

        if (!isMounted) {
          return;
        }

        setToken(storedToken);
        setUser(storedUser ? (JSON.parse(storedUser) as AuthUser) : null);
      } catch {
        await Promise.all([
          SecureStore.deleteItemAsync(TOKEN_KEY),
          SecureStore.deleteItemAsync(USER_KEY),
        ]);

        if (isMounted) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    }

    hydrateAuth();

    return () => {
      isMounted = false;
    };
  }, []);

  const persistSession = useCallback(async (auth: AuthResponse) => {
    await Promise.all([
      SecureStore.setItemAsync(TOKEN_KEY, auth.access_token),
      SecureStore.setItemAsync(USER_KEY, JSON.stringify(auth.user)),
    ]);

    setToken(auth.access_token);
    setUser(auth.user);
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const auth = await requestAuth("login", email, password);
      await persistSession(auth);
    },
    [persistSession],
  );

  const registerWithSession = useCallback(
    async (email: string, password: string, username: string) => {
      const auth = await requestAuth("signup", email, password, username);
      await persistSession(auth);
    },
    [persistSession],
  );

  const logout = useCallback(async () => {
    await Promise.all([
      SecureStore.deleteItemAsync(TOKEN_KEY),
      SecureStore.deleteItemAsync(USER_KEY),
    ]);

    setToken(null);
    setUser(null);
  }, []);

  const updateStoredUser = useCallback(async (nextUser: AuthUser) => {
    await SecureStore.setItemAsync(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
  }, []);

  const checkUsernameAvailability = useCallback(
    async (username: string) => {
      if (!token) {
        throw new Error("You need to sign in first.");
      }

      const response = await fetch(
        `${XMON_API_URL}/api/users/username-availability?username=${encodeURIComponent(username)}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      const data = (await response.json().catch(() => null)) as {
        available?: boolean;
        message?: string;
      } | null;

      if (!response.ok || typeof data?.available !== "boolean") {
        throw new Error(data?.message ?? "Could not check username.");
      }

      return data.available;
    },
    [token],
  );

  const updateUsername = useCallback(
    async (username: string) => {
      if (!token) {
        throw new Error("You need to sign in first.");
      }

      const response = await fetch(`${XMON_API_URL}/api/users/me`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username }),
      });
      const data = (await response.json().catch(() => null)) as
        | (Partial<AuthUser> & { message?: string })
        | null;

      if (!response.ok || !data?.id || !data.email || !data.username) {
        throw new Error(data?.message ?? "Could not update username.");
      }

      const nextUser = data as AuthUser;
      await updateStoredUser(nextUser);
      return nextUser;
    },
    [token, updateStoredUser],
  );

  const deleteAccount = useCallback(async () => {
    if (!token) {
      throw new Error("You need to sign in first.");
    }

    const response = await fetch(`${XMON_API_URL}/api/users/me`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    const data = (await response.json().catch(() => null)) as {
      message?: string;
    } | null;

    if (!response.ok) {
      throw new Error(data?.message ?? "Could not delete account.");
    }

    await logout();
  }, [logout, token]);

  const value = useMemo(
    () => ({
      user,
      token,
      isLoading,
      login,
      register: registerWithSession,
      logout,
      updateUsername,
      deleteAccount,
      checkUsernameAvailability,
    }),
    [
      checkUsernameAvailability,
      deleteAccount,
      isLoading,
      login,
      logout,
      registerWithSession,
      token,
      updateUsername,
      user,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

export async function register(
  email: string,
  password: string,
  username: string,
) {
  return requestAuth("signup", email, password, username);
}
