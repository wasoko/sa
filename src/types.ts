// types.ts or a similar file
import type { Database } from './sq.types'; // Adjust the import path as needed

// Helper types
export type Row<T extends keyof Database['tt']['Tables']> = Database['tt']['Tables'][T]['Row'];
export type InsertDto<T extends keyof Database['tt']['Tables']> = Database['tt']['Tables'][T]['Insert'];
export type UpdateDto<T extends keyof Database['tt']['Tables']> = Database['tt']['Tables'][T]['Update'];

// Specific table types
export type Rt = Row<'rt'>;
export type RtInsert = InsertDto<'rt'>;
export type RtUpdate = UpdateDto<'rt'>;


// Get the Arguments object for a specific function
export type RpcArgs<T extends keyof Database['tt']['Functions']> = 
  Database['tt']['Functions'][T]['Args'];

// Get the Return type (usually an array of objects for RETURNS TABLE)
export type RpcReturn<T extends keyof Database['tt']['Functions']> = 
  Database['tt']['Functions'][T]['Returns'];