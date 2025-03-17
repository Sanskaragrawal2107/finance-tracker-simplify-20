
import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { supabase } from '../integrations/supabase/client';
import PageTitle from '../components/common/PageTitle';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { SiteDetailTransactions } from '../components/sites/SiteDetailTransactions';
import { useToast } from '../hooks/use-toast';

const SiteTransactions = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [site, setSite] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [transactions, setTransactions] = useState<{
    funds: any[];
    expenses: any[];
    advances: any[];
  }>({
    funds: [],
    expenses: [],
    advances: [],
  });
  
  useEffect(() => {
    if (location.state?.site) {
      setSite(location.state.site);
    }
    fetchSite();
    fetchTransactions();
    setupRealtimeSubscription();
    
    return () => {
      // Cleanup subscription
      const channel = supabase.channel('schema-db-changes');
      supabase.removeChannel(channel);
    };
  }, [id]);
  
  const setupRealtimeSubscription = () => {
    if (!id) return;
    
    const channel = supabase.channel('schema-db-changes')
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'funds_received',
        filter: `site_id=eq.${id}`
      }, () => {
        fetchTransactions();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'expenses',
        filter: `site_id=eq.${id}`
      }, () => {
        fetchTransactions();
      })
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'advances',
        filter: `site_id=eq.${id}`
      }, () => {
        fetchTransactions();
      })
      .subscribe();
  };
  
  const fetchSite = async () => {
    try {
      if (!id) return;
      
      const { data, error } = await supabase
        .from('sites')
        .select('*')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      if (data) setSite(data);
    } catch (error: any) {
      console.error('Error fetching site:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load site details',
        variant: 'destructive',
      });
    }
  };
  
  const fetchTransactions = async () => {
    if (!id) return;
    
    setLoading(true);
    try {
      // Fetch funds received
      const { data: fundsData, error: fundsError } = await supabase
        .from('funds_received')
        .select('*')
        .eq('site_id', id)
        .order('date', { ascending: false });
        
      if (fundsError) throw fundsError;
      
      // Fetch expenses
      const { data: expensesData, error: expensesError } = await supabase
        .from('expenses')
        .select('*')
        .eq('site_id', id)
        .order('date', { ascending: false });
        
      if (expensesError) throw expensesError;
      
      // Fetch advances
      const { data: advancesData, error: advancesError } = await supabase
        .from('advances')
        .select('*')
        .eq('site_id', id)
        .order('date', { ascending: false });
        
      if (advancesError) throw advancesError;
      
      setTransactions({
        funds: fundsData || [],
        expenses: expensesData || [],
        advances: advancesData || [],
      });
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to load transactions',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoBack = () => {
    navigate(-1);
  };
  
  const handleDeleteTransaction = async (type: string, id: string) => {
    try {
      let error;
      
      switch (type) {
        case 'funds':
          ({ error } = await supabase.from('funds_received').delete().eq('id', id));
          break;
        case 'expenses':
          ({ error } = await supabase.from('expenses').delete().eq('id', id));
          break;
        case 'advances':
          ({ error } = await supabase.from('advances').delete().eq('id', id));
          break;
      }
      
      if (error) throw error;
      
      toast({
        title: 'Success',
        description: 'Transaction deleted successfully',
      });
      
      // Manual update while waiting for realtime to trigger
      fetchTransactions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to delete transaction',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 max-w-7xl">
      <div className="flex items-center mb-6 space-x-4">
        <Button 
          variant="ghost" 
          onClick={handleGoBack}
          className="p-2 hover:bg-gray-100 transition-colors rounded-full"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <PageTitle title={site?.name ? `${site.name} Transactions` : 'Site Transactions'} />
      </div>
      
      {site && (
        <Card className="mb-6 bg-white shadow-sm border">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <h3 className="text-sm font-medium text-gray-500">Site Name</h3>
                <p className="text-lg font-medium">{site.name}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">Location</h3>
                <p className="text-lg font-medium">{site.location}</p>
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-500">POS Number</h3>
                <p className="text-lg font-medium">{site.pos_no || 'N/A'}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <Tabs 
        defaultValue="all" 
        className="w-full" 
        value={activeTab} 
        onValueChange={setActiveTab}
      >
        <TabsList className="w-full mb-6 bg-white border rounded-lg overflow-hidden">
          <TabsTrigger className="flex-1" value="all">All Transactions</TabsTrigger>
          <TabsTrigger className="flex-1" value="funds">Funds Received</TabsTrigger>
          <TabsTrigger className="flex-1" value="expenses">Expenses</TabsTrigger>
          <TabsTrigger className="flex-1" value="advances">Advances</TabsTrigger>
        </TabsList>
        
        {loading ? (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : (
          <>
            <TabsContent value="all">
              <SiteDetailTransactions 
                fundsReceived={transactions.funds}
                expenses={transactions.expenses}
                advances={transactions.advances}
                onDelete={handleDeleteTransaction}
                onEdit={(type, transactionId) => {
                  // Navigate to edit form
                  const path = type === 'funds' 
                    ? `/edit-funds/${transactionId}` 
                    : type === 'expenses' 
                      ? `/edit-expense/${transactionId}` 
                      : `/edit-advance/${transactionId}`;
                  
                  navigate(path, { 
                    state: { 
                      siteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
                onAddNew={(type) => {
                  // Navigate to add form
                  const path = type === 'funds' 
                    ? '/funds-received' 
                    : type === 'expenses' 
                      ? '/expenses' 
                      : '/advances';
                  
                  navigate(path, { 
                    state: { 
                      preselectedSiteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
              />
            </TabsContent>
            
            <TabsContent value="funds">
              <SiteDetailTransactions 
                fundsReceived={transactions.funds}
                expenses={[]}
                advances={[]}
                onDelete={handleDeleteTransaction}
                onEdit={(type, transactionId) => {
                  navigate(`/edit-funds/${transactionId}`, { 
                    state: { 
                      siteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
                onAddNew={() => {
                  navigate('/funds-received', { 
                    state: { 
                      preselectedSiteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
              />
            </TabsContent>
            
            <TabsContent value="expenses">
              <SiteDetailTransactions 
                fundsReceived={[]}
                expenses={transactions.expenses}
                advances={[]}
                onDelete={handleDeleteTransaction}
                onEdit={(type, transactionId) => {
                  navigate(`/edit-expense/${transactionId}`, { 
                    state: { 
                      siteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
                onAddNew={() => {
                  navigate('/expenses', { 
                    state: { 
                      preselectedSiteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
              />
            </TabsContent>
            
            <TabsContent value="advances">
              <SiteDetailTransactions 
                fundsReceived={[]}
                expenses={[]}
                advances={transactions.advances}
                onDelete={handleDeleteTransaction}
                onEdit={(type, transactionId) => {
                  navigate(`/edit-advance/${transactionId}`, { 
                    state: { 
                      siteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
                onAddNew={() => {
                  navigate('/advances', { 
                    state: { 
                      preselectedSiteId: id,
                      returnPath: `/site-transactions/${id}`,
                      site
                    }
                  });
                }}
              />
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  );
};

export default SiteTransactions;
