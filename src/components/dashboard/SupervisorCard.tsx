
import React from 'react';
import { Card, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { useNavigate } from 'react-router-dom';

interface SupervisorCardProps {
  supervisor: {
    id: string;
    name: string;
    email?: string;
  };
}

const SupervisorCard: React.FC<SupervisorCardProps> = ({ supervisor }) => {
  const navigate = useNavigate();
  
  const handleViewSites = () => {
    // Navigate to expenses page with supervisor filter applied
    navigate('/expenses', { state: { supervisorId: supervisor.id } });
  };
  
  return (
    <Card className="overflow-hidden border bg-white shadow-sm transition-all hover:shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-medium">{supervisor.name}</h3>
            {supervisor.email && (
              <p className="text-sm text-gray-500">{supervisor.email}</p>
            )}
          </div>
          <Button 
            onClick={handleViewSites}
            variant="outline"
            className="transition-all hover:bg-gray-100"
          >
            View Sites
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default SupervisorCard;
