import { lazy, Suspense, useEffect, useState } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import {
  BrowserRouter as Router,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import ScrollToTop from "./components/ScrollToTop";
import RouteSeo from "@/components/seo/RouteSeo";
import GoogleAnalytics from "@/components/analytics/GoogleAnalytics";
import Layout from "@/components/Layout";
import RequireAuth from "@/components/guards/RequireAuth";
import RequireAdmin from "@/components/guards/RequireAdmin";

const CookieConsent = lazy(() => import("@/components/CookieConsent"));
const UserNotRegisteredError = lazy(
  () => import("@/components/UserNotRegisteredError"),
);
const Toaster = lazy(() =>
  import("@/components/ui/toaster").then((module) => ({
    default: module.Toaster,
  })),
);
const PageNotFound = lazy(() => import("./lib/PageNotFound"));
const Home = lazy(() => import("./pages/Home"));
const Search = lazy(() => import("./pages/Search"));
const ProviderProfile = lazy(() => import("./pages/ProviderProfile"));
const OrganizationProfile = lazy(() => import("./pages/OrganizationProfile"));
const RequestMatches = lazy(() => import("./pages/RequestMatches"));
const ProfessionalProfile = lazy(() => import("./pages/ProfessionalProfile"));
const RequestFlow = lazy(() => import("./pages/RequestFlow"));
const ForSpecialists = lazy(() => import("./pages/ForSpecialists"));
const Partners = lazy(() => import("./pages/Partners"));
const AboutViasee = lazy(() => import("./pages/AboutViasee"));
const AddOrClaim = lazy(() => import("./pages/AddOrClaim"));
const GuideIndex = lazy(() => import("./pages/GuideIndex"));
// PROTOTIP temporar (2026-08-06) - ecran de validare a directiei pentru configurarea
// serviciilor. Nu e legat de date reale; de sters daca directia nu se confirma.
const PrototipServicii = lazy(() => import("./pages/PrototipServicii"));
const SpecialistGuide = lazy(() => import("./pages/SpecialistGuide"));
const TopicGuide = lazy(() => import("./pages/TopicGuide"));
const SpecialistComparison = lazy(
  () => import("./pages/SpecialistComparison"),
);
const EditorialMethodology = lazy(
  () => import("./pages/EditorialMethodology"),
);
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

function PageLoading() {
  return (
    <div
      className="flex min-h-[45vh] items-center justify-center bg-background"
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

function DeferredClientUi() {
  const [cookieUiMounted, setCookieUiMounted] = useState(false);
  const [toasterMounted, setToasterMounted] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setCookieUiMounted(true));
    let toasterTimer = window.setTimeout(() => setToasterMounted(true), 3000);

    const mountToaster = () => {
      window.clearTimeout(toasterTimer);
      toasterTimer = 0;
      setToasterMounted(true);
    };

    window.addEventListener("pointerdown", mountToaster, {
      once: true,
      passive: true,
    });
    window.addEventListener("keydown", mountToaster, { once: true });

    return () => {
      window.cancelAnimationFrame(frame);
      if (toasterTimer) window.clearTimeout(toasterTimer);
      window.removeEventListener("pointerdown", mountToaster);
      window.removeEventListener("keydown", mountToaster);
    };
  }, []);

  return (
    <>
      {cookieUiMounted && (
        <Suspense fallback={null}>
          <CookieConsent />
        </Suspense>
      )}
      {toasterMounted && (
        <Suspense fallback={null}>
          <Toaster />
        </Suspense>
      )}
    </>
  );
}

const AppRoutes = () => {
  const { isLoadingPublicSettings, authError, navigateToLogin } = useAuth();
  const resolvedAuthError = isLoadingPublicSettings ? null : authError;

  useEffect(() => {
    if (resolvedAuthError?.type === "auth_required") {
      void navigateToLogin(window.location.href);
    }
  }, [navigateToLogin, resolvedAuthError]);

  if (resolvedAuthError?.type === "user_not_registered") {
    return (
      <Suspense fallback={<PageLoading />}>
        <UserNotRegisteredError />
      </Suspense>
    );
  }

  if (resolvedAuthError?.type === "auth_required") return null;

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
          <Route path="/despre-viasee" element={<AboutViasee />} />
          <Route path="/furnizor/:id" element={<ProviderProfile />} />
          <Route path="/organizatie/:id" element={<OrganizationProfile />} />
          <Route path="/rezultate" element={<RequestMatches />} />
          <Route path="/specialist/:id" element={<ProfessionalProfile />} />
          <Route path="/cerere" element={<RequestFlow />} />
          <Route path="/ghid" element={<GuideIndex />} />
          <Route path="/prototip-servicii" element={<PrototipServicii />} />
          <Route
            path="/ghid/optometrist-optician-oftalmolog"
            element={<SpecialistComparison />}
          />
          <Route path="/ghid/:category/:slug" element={<TopicGuide />} />
          <Route path="/ghid/:slug" element={<SpecialistGuide />} />
          <Route
            path="/cum-verificam-informatiile"
            element={<EditorialMethodology />}
          />
          <Route
            path="/revendica-profil"
            element={<Navigate to="/adauga-sau-revendica" replace />}
          />
          <Route
            path="/inscriere"
            element={<Navigate to="/adauga-sau-revendica" replace />}
          />
          {/* Inscrierea/revendicarea cere cont de la primul pas (2026-08-18): orice tip de
              cont are nevoie de autentificare, deci poarta sta la intrare, o singura data,
              in loc de redirecturi la mijlocul formularului. */}
          <Route element={<RequireAuth />}>
            <Route path="/adauga-sau-revendica" element={<AddOrClaim />} />
          </Route>
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
          <RouteSeo />
          <GoogleAnalytics />
          <AppRoutes />
          <DeferredClientUi />
        </Router>
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;