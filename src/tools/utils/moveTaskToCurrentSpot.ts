import { Note } from "./note-utils";
import { Task } from "./task-utils";
import { findCurrentSpot } from "./note-utils";
import { insertTaskAtPosition } from "./task-utils";
import { removeTaskFromDocument } from "./task-utils";

/**
 * Move a task to the "current spot" in a document
 * @param document The document to modify
 * @param taskToMove The task to move
 * @returns The modified document
 */

export function moveTaskToCurrentSpot(document: Note, taskToMove: Task): Note {
  // Create a copy to avoid modifying the original
  const newDocument = JSON.parse(JSON.stringify(document)) as Note;

  const index = findCurrentSpot(newDocument);
  const documentAfterRemoval = removeTaskFromDocument(newDocument, taskToMove);
  return insertTaskAtPosition(documentAfterRemoval, taskToMove, index);
}
