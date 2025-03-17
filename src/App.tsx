
import React, { useEffect, useState } from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import Index from './pages/Index';
import Dashboard from './pages/Dashboard';
import HeadOffice from './pages/HeadOffice';
import Expenses from './pages/Expenses';
import AdminDashboard from './pages/AdminDashboard';
import { Toaster } from './components/ui/toaster';
import { supabase } from './integrations/supabase/client';
import { ThemeProvider } from './components/ui/theme-provider';
import './App.css';
import Advances from './pages/Advances';
import Invoices from './pages/Invoices';
import NotFound from './pages/NotFound';
import SupervisorSites from './pages/SupervisorSites';
import SiteTransactions from './pages/SiteTransactions';
import EditExpenseForm from './components/expenses/EditExpenseForm';
import EditFundsForm from './components/funds/EditFundsForm';
import EditAdvanceForm from './components/advances/EditAdvanceForm';

function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_IN' && session?.user) {
          console.info('Auth state change - SIGNED_IN:', session.user.id);
          setUser(session.user);
          
          try {
            console.info('Fetching user profile for ID:', session.user.id);
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (error) {
              throw error;
            }
            
            if (data) {
              setUser({ ...session.user, ...data });
            }
          } catch (error) {
            console.error('Error fetching user profile:', error);
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
        }
        
        setLoading(false);
      }
    );

    const checkUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (error) {
            throw error;
          }
          
          if (data) {
            setUser({ ...session.user, ...data });
          } else {
            setUser(session.user);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
          setUser(session.user);
        }
      }
      
      setLoading(false);
    };

    checkUser();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <ThemeProvider defaultTheme="light" storageKey="vite-ui-theme">
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Index />} />
        {/* Use render props pattern to pass user prop to components */}
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/head-office" element={user ? <HeadOffice user={user} /> : <Navigate to="/" />} />
        <Route path="/expenses" element={user ? <Expenses /> : <Navigate to="/" />} />
        <Route path="/advances" element={user ? <Advances /> : <Navigate to="/" />} />
        <Route path="/invoices" element={user ? <Invoices /> : <Navigate to="/" />} />
        <Route path="/admin-dashboard" element={user ? <AdminDashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/supervisor-sites" element={user ? <SupervisorSites user={user} /> : <Navigate to="/" />} />
        <Route path="/site-transactions/:id" element={user ? <SiteTransactions user={user} /> : <Navigate to="/" />} />
        <Route path="/edit-expense/:id" element={user ? <EditExpenseForm /> : <Navigate to="/" />} />
        <Route path="/edit-funds/:id" element={user ? <EditFundsForm /> : <Navigate to="/" />} />
        <Route path="/edit-advance/:id" element={user ? <EditAdvanceForm /> : <Navigate to="/" />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </ThemeProvider>
  );
}

export default App;
