import * as Realm from "realm-web";
import { from, Observable, of } from "rxjs";
import { catchError, map } from "rxjs/operators";
import { RealmService } from "./RealmService";

// Generic interface for MongoDB documents
export interface IMongoDocument {
  _id: Realm.BSON.ObjectId;
  _partition?: string;
  [key: string]: any;
}

// Generic service for MongoDB Realm collection operations
export class MongoService {
  private realmService: RealmService;

  constructor() {
    this.realmService = RealmService.getInstance();
  }

  // Get MongoDB collection
  private getCollection<T>(collectionName: string): Realm.Services.MongoDB.MongoCollection<T> {
    const app = this.realmService.getApp();
    const user = app.currentUser;

    if (!user) {
      throw new Error("User not authenticated. Please login first.");
    }

    const mongo = user.mongoClient("mongodb-atlas");
    return mongo.db("xiimalab").collection<T>(collectionName);
  }

  // Find all documents in a collection
  public findAll<T extends IMongoDocument>(collectionName: string): Observable<T[]> {
    return from(
      this.getCollection<T>(collectionName).find({})
    ).pipe(
      catchError(error => {
        console.error(`Error finding documents in ${collectionName}:`, error);
        return of([]);
      })
    );
  }

  // Find documents by query
  public findByQuery<T extends IMongoDocument>(
    collectionName: string,
    query: Realm.Services.MongoDB.Filter
  ): Observable<T[]> {
    return from(
      this.getCollection<T>(collectionName).find(query)
    ).pipe(
      catchError(error => {
        console.error(`Error finding documents in ${collectionName} with query:`, query, error);
        return of([]);
      })
    );
  }

  // Find one document by ID
  public findById<T extends IMongoDocument>(
    collectionName: string,
    id: string | Realm.BSON.ObjectId
  ): Observable<T | null> {
    const objectId = typeof id === "string" ? new Realm.BSON.ObjectId(id) : id;

    return from(
      this.getCollection<T>(collectionName).findOne({ _id: objectId } as any)
    ).pipe(
      map(doc => doc || null),
      catchError(error => {
        console.error(`Error finding document in ${collectionName} with id ${id}:`, error);
        return of(null);
      })
    );
  }

  // Insert a new document
  public insertOne<T extends IMongoDocument>(
    collectionName: string,
    document: Omit<T, "_id">
  ): Observable<T> {
    return from(
      this.getCollection<T>(collectionName).insertOne(document as any)
    ).pipe(
      map(result => ({
        ...document,
        _id: result.insertedId
      }) as T),
      catchError(error => {
        console.error(`Error inserting document in ${collectionName}:`, error);
        throw error;
      })
    );
  }

  // Update a document by ID
  public updateById<T extends IMongoDocument>(
    collectionName: string,
    id: string | Realm.BSON.ObjectId,
    update: Partial<Omit<T, "_id">>
  ): Observable<boolean> {
    const objectId = typeof id === "string" ? new Realm.BSON.ObjectId(id) : id;

    return from(
      this.getCollection<T>(collectionName).updateOne(
        { _id: objectId } as any,
        { $set: update }
      )
    ).pipe(
      map(result => result.modifiedCount > 0),
      catchError(error => {
        console.error(`Error updating document in ${collectionName} with id ${id}:`, error);
        return of(false);
      })
    );
  }

  // Delete a document by ID
  public deleteById(
    collectionName: string,
    id: string | Realm.BSON.ObjectId
  ): Observable<boolean> {
    const objectId = typeof id === "string" ? new Realm.BSON.ObjectId(id) : id;

    return from(
      this.getCollection(collectionName).deleteOne({ _id: objectId } as any)
    ).pipe(
      map(result => result.deletedCount > 0),
      catchError(error => {
        console.error(`Error deleting document in ${collectionName} with id ${id}:`, error);
        return of(false);
      })
    );
  }

  // Watch for changes in a collection (real-time updates)
  public watchCollection<T extends IMongoDocument>(
    collectionName: string,
    filter: Realm.Services.MongoDB.Filter = {}
  ): Observable<T[]> {
    // Note: This is a simplified implementation
    // For real-time watching, you would need to implement a more complex solution
    // using Realm's watch functionality or MongoDB change streams
    return this.findByQuery<T>(collectionName, filter);
  }
}