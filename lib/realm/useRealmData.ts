// lib/realm/useRealmData.ts
// React hook for MongoDB Realm data operations in Xiimalab

import { useState, useEffect, useCallback } from 'react';
import { MongoService, IMongoDocument } from './MongoService';
import { Observable, Subscription } from 'rxjs';

/**
 * Generic React hook for MongoDB Realm data operations
 * Provides reactive data fetching and mutation capabilities
 */
export function useRealmData() {
  const [mongoService] = useState(() => new MongoService());
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper to set loading state for a specific operation
  const setLoadingState = useCallback((operation: string, isLoading: boolean) => {
    setLoading(prev => ({ ...prev, [operation]: isLoading }));
  }, []);

  // Helper to set error state for a specific operation
  const setErrorState = useCallback((operation: string, error: string | null) => {
    if (error) {
      setErrors(prev => ({ ...prev, [operation]: error }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[operation];
        return newErrors;
      });
    }
  }, []);

  // Find all documents in a collection
  const findAll = useCallback(<T extends IMongoDocument>(
    collectionName: string,
    operationId: string = `findAll_${collectionName}`
  ): Promise<T[]> => {
    setLoadingState(operationId, true);
    setErrorState(operationId, null);

    return new Promise((resolve, reject) => {
      const subscription = mongoService.findAll<T>(collectionName).subscribe({
        next: (documents) => {
          setLoadingState(operationId, false);
          resolve(documents);
        },
        error: (error) => {
          setLoadingState(operationId, false);
          setErrorState(operationId, error.message);
          reject(error);
        }
      });

      // Clean up subscription on unmount
      return () => subscription.unsubscribe();
    });
  }, [mongoService, setLoadingState, setErrorState]);

  // Find documents by query
  const findByQuery = useCallback(<T extends IMongoDocument>(
    collectionName: string,
    query: any,
    operationId: string = `findByQuery_${collectionName}`
  ): Promise<T[]> => {
    setLoadingState(operationId, true);
    setErrorState(operationId, null);

    return new Promise((resolve, reject) => {
      const subscription = mongoService.findByQuery<T>(collectionName, query).subscribe({
        next: (documents) => {
          setLoadingState(operationId, false);
          resolve(documents);
        },
        error: (error) => {
          setLoadingState(operationId, false);
          setErrorState(operationId, error.message);
          reject(error);
        }
      });

      // Clean up subscription on unmount
      return () => subscription.unsubscribe();
    });
  }, [mongoService, setLoadingState, setErrorState]);

  // Find one document by ID
  const findById = useCallback(<T extends IMongoDocument>(
    collectionName: string,
    id: string,
    operationId: string = `findById_${collectionName}_${id}`
  ): Promise<T | null> => {
    setLoadingState(operationId, true);
    setErrorState(operationId, null);

    return new Promise((resolve, reject) => {
      const subscription = mongoService.findById<T>(collectionName, id).subscribe({
        next: (document) => {
          setLoadingState(operationId, false);
          resolve(document);
        },
        error: (error) => {
          setLoadingState(operationId, false);
          setErrorState(operationId, error.message);
          reject(error);
        }
      });

      // Clean up subscription on unmount
      return () => subscription.unsubscribe();
    });
  }, [mongoService, setLoadingState, setErrorState]);

  // Insert a new document
  const insertOne = useCallback(<T extends IMongoDocument>(
    collectionName: string,
    document: Omit<T, "_id">,
    operationId: string = `insertOne_${collectionName}`
  ): Promise<T> => {
    setLoadingState(operationId, true);
    setErrorState(operationId, null);

    return new Promise((resolve, reject) => {
      const subscription = mongoService.insertOne<T>(collectionName, document).subscribe({
        next: (result) => {
          setLoadingState(operationId, false);
          resolve(result);
        },
        error: (error) => {
          setLoadingState(operationId, false);
          setErrorState(operationId, error.message);
          reject(error);
        }
      });

      // Clean up subscription on unmount
      return () => subscription.unsubscribe();
    });
  }, [mongoService, setLoadingState, setErrorState]);

  // Update a document by ID
  const updateById = useCallback(
    (
      collectionName: string,
      id: string,
      update: Partial<any>,
      operationId: string = `updateById_${collectionName}_${id}`
    ): Promise<boolean> => {
      setLoadingState(operationId, true);
      setErrorState(operationId, null);

      return new Promise((resolve, reject) => {
        const subscription = mongoService.updateById(collectionName, id, update).subscribe({
          next: (result) => {
            setLoadingState(operationId, false);
            resolve(result);
          },
          error: (error) => {
            setLoadingState(operationId, false);
            setErrorState(operationId, error.message);
            reject(error);
          }
        });

        // Clean up subscription on unmount
        return () => subscription.unsubscribe();
      });
    }, [mongoService, setLoadingState, setErrorState]);

  // Delete a document by ID
  const deleteById = useCallback(
    (
      collectionName: string,
      id: string,
      operationId: string = `deleteById_${collectionName}_${id}`
    ): Promise<boolean> => {
      setLoadingState(operationId, true);
      setErrorState(operationId, null);

      return new Promise((resolve, reject) => {
        const subscription = mongoService.deleteById(collectionName, id).subscribe({
          next: (result) => {
            setLoadingState(operationId, false);
            resolve(result);
          },
          error: (error) => {
            setLoadingState(operationId, false);
            setErrorState(operationId, error.message);
            reject(error);
          }
        });

        // Clean up subscription on unmount
        return () => subscription.unsubscribe();
      });
    }, [mongoService, setLoadingState, setErrorState]);

  return {
    // Data operations
    findAll,
    findByQuery,
    findById,
    insertOne,
    updateById,
    deleteById,

    // State
    loading,
    errors,

    // Helpers
    isLoading: (operationId: string) => !!loading[operationId],
    getError: (operationId: string) => errors[operationId] || null
  };
}