import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { AppLayout } from "@/components/AppLayout";
import LandingPage from "./pages/LandingPage";
import Dashboard from "./pages/Dashboard";
import GeneratePage from "./pages/GeneratePage";
import HistoryPage from "./pages/HistoryPage";
import FavoritesPage from "./pages/FavoritesPage";
import SettingsPage from "./pages/SettingsPage";
import BusinessProfilePage from "./pages/BusinessProfilePage";
import BusinessDNAPage from "./pages/BusinessDNAPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import AnalyticsPage from "./pages/AnalyticsPage";
import WinningRepliesPage from "./pages/WinningRepliesPage";
import SignInPage from "./pages/SignInPage";
import PrivacyPage from "./pages/PrivacyPage";
import TermsPage from "./pages/TermsPage";
import DataDeletionPage from "./pages/DataDeletionPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LanguageProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/signin" element={<SignInPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/data-deletion" element={<DataDeletionPage />} />
            <Route path="/app" element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="generate" element={<GeneratePage />} />
              <Route path="history" element={<HistoryPage />} />
              <Route path="favorites" element={<FavoritesPage />} />
              <Route path="business" element={<BusinessProfilePage />} />
              <Route path="business-dna" element={<BusinessDNAPage />} />
              <Route path="knowledge" element={<KnowledgeBasePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="library" element={<WinningRepliesPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </LanguageProvider>
  </QueryClientProvider>
);

export default App;
