import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DataProvider } from "@/context/DataContext";
import Layout from "@/components/Layout";
import Datasets from "./pages/Datasets";
import Coverage from "./pages/Coverage";
import Dictionary from "./pages/Dictionary";
import Quality from "./pages/Quality";
import ReviewBasket from "./pages/ReviewBasket";
import NBA from "./pages/NBA";
import MLB from "./pages/MLB";
import Status from "./pages/Status";
import RawDataLab from "./pages/RawDataLab";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();
const basename = import.meta.env.BASE_URL.replace(/\/$/, "");

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <DataProvider>
        <BrowserRouter basename={basename || "/"}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/" element={<Datasets />} />
              <Route path="/datasets" element={<Datasets />} />
              <Route path="/coverage" element={<Coverage />} />
              <Route path="/dictionary" element={<Dictionary />} />
              <Route path="/quality" element={<Quality />} />
              <Route path="/basket" element={<ReviewBasket />} />
              <Route path="/explore" element={<RawDataLab />} />
              <Route path="/raw" element={<Navigate to="/explore" replace />} />
              <Route path="/nba" element={<NBA />} />
              <Route path="/mlb" element={<MLB />} />
              <Route path="/status" element={<Status />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </DataProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
