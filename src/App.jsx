import { Toaster } from "@/components/ui/toaster";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClientInstance } from "@/lib/query-client";
import { BrowserRouter as Router, Navigate, Route, Routes } from "react-router-dom";
import PageNotFound from "./lib/PageNotFound";
import { AuthProvider, useAuth } from "@/lib/AuthContext";
import UserNotRegisteredError from "@/components/UserNotRegisteredError";
import ScrollToTop from "./components/ScrollToTop";
import Layout from "@/components/Layout";
import Home from "./pages/Home";
import Search from "./pages/Search";
import ProviderProfile from "./pages/ProviderProfile";
import ProfessionalProfile from "./pages/ProfessionalProfile";
import RequestFlow from "./pages/RequestFlow";
import ForSpecialists from "./pages/ForSpecialists";
import Partners from "./pages/Partners";
import AddOrClaim from "./pages/AddOrClaim";
import AcceptProfessionalInvitation from "./pages/AcceptProfessionalInvitation";
import AcceptProviderInvitation from "./pages/AcceptProviderInvitation";
import ProfessionalOnboarding from "./pages/ProfessionalOnboarding";
import MyAccount from "./pages/MyAccount";
import HelpSupport from "./pages/HelpSupport";
import AdminDirectoryOps from "./pages/AdminDirectoryOps";
import PostLogin from "./pages/PostLogin";
import RequireAuth from "@/components/guards/RequireAuth";
import RequireAdmin from "@/components/guards/RequireAdmin";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-slate-800" />
      </div>
    );
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
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/pentru-specialisti" element={<ForSpecialists />} />
      <Route path="/accept-professional-invitation" element={<AcceptProfessionalInvitation />} />
      <Route path="/accept-provider-invitation" element={<AcceptProviderInvitation />} />

      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
        <Route path="/cauta" element={<Search />} />
        <Route path="/parteneri" element={<Partners />} />
        <Route path="/furnizor/:id" element={<ProviderProfile />} />
        <Route path="/specialist/:id" element={<ProfessionalProfile />} />
        <Route path="/cerere" element={<RequestFlow />} />
        <Route path="/revendica-profil" element={<Navigate to="/adauga-sau-revendica" replace />} />
        <Route path="/inscriere" element={<Navigate to="/adauga-sau-revendica" replace />} />
        <Route path="/adauga-sau-revendica" element={<AddOrClaim />} />
        <Route path="/confidentialitate" element={<Privacy />} />
        <Route path="/termeni" element={<Terms />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route path="/profil-profesional/nou" element={<ProfessionalOnboarding />} />
        <Route path="/contul-meu" element={<MyAccount />} />
        <Route path="/contul-meu/locatii/:locationId/:locationModule" element={<MyAccount />} />
        <Route path="/ajutor-si-suport" element={<HelpSupport />} />
        <Route path="/dupa-login" element={<PostLogin />} />
      </Route>

      <Route element={<RequireAdmin />}>
        <Route path="/admin/verificari" element={<Navigate to="/admin/operatiuni" replace />} />
        <Route path="/admin/operatiuni" element={<AdminDirectoryOps />} />
      </Route>

      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
};

function App() {
  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  );
}

export default App;
