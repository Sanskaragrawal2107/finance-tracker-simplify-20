
import React from 'react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Edit, Trash } from "lucide-react";

interface DataTableProps<TData, TValue> {
  columns: {
    accessorKey: string;
    header: string;
    cell?: (props: { row: any }) => React.ReactNode;
  }[];
  data: TData[];
  searchKey?: string;
  onView?: (row: TData) => void;
  onEdit?: (row: TData) => void;
  onDelete?: (row: TData) => void;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  onView,
  onEdit,
  onDelete,
}: DataTableProps<TData, TValue>) {
  const [searchValue, setSearchValue] = React.useState("");

  const filteredData = React.useMemo(() => {
    if (!searchKey || !searchValue) return data;
    
    return data.filter((item: any) => {
      const value = item[searchKey];
      if (typeof value === 'string') {
        return value.toLowerCase().includes(searchValue.toLowerCase());
      }
      return false;
    });
  }, [data, searchKey, searchValue]);

  return (
    <div className="space-y-4">
      {searchKey && (
        <div className="flex justify-between items-center">
          <Input
            placeholder={`Search by ${searchKey}...`}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            className="max-w-sm"
          />
        </div>
      )}
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column, index) => (
                <TableHead key={index}>{column.header}</TableHead>
              ))}
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredData.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + 1} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            ) : (
              filteredData.map((row: any, rowIndex) => (
                <TableRow key={rowIndex}>
                  {columns.map((column, columnIndex) => (
                    <TableCell key={`${rowIndex}-${columnIndex}`}>
                      {column.cell
                        ? column.cell({ row })
                        : row[column.accessorKey]}
                    </TableCell>
                  ))}
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {onView && (
                        <Button variant="ghost" size="icon" onClick={() => onView(row)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      )}
                      {onEdit && (
                        <Button variant="ghost" size="icon" onClick={() => onEdit(row)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                      )}
                      {onDelete && (
                        <Button variant="ghost" size="icon" onClick={() => onDelete(row)}>
                          <Trash className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
