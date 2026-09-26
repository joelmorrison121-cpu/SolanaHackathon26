import ErrorBoundary from "./components/ErrorBoundary";
import Home from "./pages/Home";
import CreateBill from "./pages/CreateBill";
import Pay from "./pages/Pay";
import NotFound from "./pages/NotFound";
import { Route, Switch } from "wouter";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/new" component={CreateBill} />
      <Route path="/pay/:linkToken" component={Pay} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <Router />
    </ErrorBoundary>
  );
}
