import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import CookieConsent from "@/components/CookieConsent";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/guards/RequireAuth";
import RequireAdmin from "@/components/guards/RequireAdmin";

const PageNotFound = lazy(() => import("./lib/PageNotFound"));
const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const ProviderProfile = lazy(() => import("./pages/ProviderProfile"));
const ProfessionalProfile = lazy(() => import("./pages/ProfessionalProfile"));
const RequestFlow = lazy(() => import("./pages/RequestFlow"));
const ForSpecialists = lazy(() => import("./pages/ForSpecialists"));
const Partners = lazy(() => import("./pages/Partners"));
const AddOrClaim = lazy(() => import("./pages/AddOrClaim"));
const AcceptProfessionalInvitation = lazy(
  () => import("./pages/AcceptProfessionalInvitation"),
);
const AcceptProviderInvitation = lazy(
  () => import("./pages/AcceptProviderInvitation"),
);
const ProfessionalOnboarding = lazy(
  () => import("./pages/ProfessionalOnboarding"),
);
const MyAccount = lazy(() => import("./pages/MyAccount"));
const HelpSupport = lazy(() => import("./pages/HelpSupport"));
const AdminDirectoryOps = lazy(() => import("./pages/AdminDirectoryOps"));
const PostLogin = lazy(() => import("./pages/PostLogin"));
const Privacy = lazy(() => import("./pages/Privacy"));
const Terms = lazy(() => import("./pages/Terms"));
const Cookies = lazy(() => import("./pages/Cookies"));
const PaymentsAndSubscriptions = lazy(
  () => import("./pages/PaymentsAndSubscriptions"),
);
const DataRights = lazy(() => import("./pages/DataRights"));
const Login = lazy(() => import("./pages/Login"));
const Register = lazy(() => import("./pages/Register"));
const ForgotPassword = lazy(() => import("./pages/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));

function PageLoading({ fullScreen = false }) {
  return (
    <div
      className={`${fullScreen ? "fixed inset-0" : "min-h-[45vh]"} flex items-center justify-center bg-background`}
      role="status"
      aria-live="polite"
    >
      <div
        className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-foreground"
        aria-hidden="true"
      />
      <span className="sr-only">Se încarcă pagina...</span>
    </div>
  );
}

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } =
    useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return <PageLoading fullScreen />;
  }

  if (authError) {
    if (authError.type === "user_not_registered") {
      return <UserNotRegisteredError />;
    }
    if (authError.type === "auth_required") {
      navigateToLogin();
      return null;
    }
  }

  return (
    <Suspense fallback={<PageLoading />}>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/pentru-specialisti" element={<ForSpecialists />} />
        <Route
          path="/accept-professional-invitation"
          element={<AcceptProfessionalInvitation />}
        />
        <Route
          path="/accept-provider-invitation"
          element={<AcceptProviderInvitation />}
        />

        <Route element={<Layout />}>
          <Route path="/" element={<Home />} />
          <Route path="/cauta" element={<Search />} />
          <Route path="/parteneri" element={<Partners />} />
          <Route path="/furnizor/:id" element={<ProviderProfile />} />
          <Route path="/specialist/:id" element={<ProfessionalProfile />} />
          <Route path="/cerere" element={<RequestFlow />} />
          <Route
            path="/revendica-profil"
            element={<Navigate to="/adauga-sau-revendica" replace />}
          />
          <Route
            path="/inscriere"
            element={<Navigate to="/adauga-sau-revendica" replace />}
          />
          <Route path="/adauga-sau-revendica" element={<AddOrClaim />} />
          <Route path="/confidentialitate" element={<Privacy />} />
          <Route path="/termeni" element={<Terms />} />
          <Route path="/cookies" element={<Cookies />} />
          <Route
            path="/plati-si-abonamente"
            element={<PaymentsAndSubscriptions />}
          />
          <Route path="/drepturile-tale" element={<DataRights />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route
            path="/profil-profesional/nou"
            element={<ProfessionalOnboarding />}
          />
          <Route path="/contul-meu" element={<MyAccount />} />
          <Route
            path="/contul-meu/locatii/:locationId/:locationModule"
            element={<MyAccount />}
          />
          <Route path="/ajutor-si-suport" element={<HelpSupport />} />
          <Route path="/dupa-login" element={<PostLogin />} />
        </Route>

        <Route element={<RequireAdmin />}>
          <Route
            path="/admin/verificari"
            element={<Navigate to="/admin/operatiuni" replace />}
          />
          <Route path="/admin/operatiuni" element={<AdminDirectoryOps />} />
        </Route>

        <Route path="*" element={<PageNotFound />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <CookieConsent />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
