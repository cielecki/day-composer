import { Note } from "../tools/note-utils";
import { Task } from "./task-utils";
import { determineInsertionPosition } from "../tools/note-utils";
import { insertTaskAtPosition } from "../task/task-utils";
import { removeTaskFromDocument } from "../task/task-utils";

/**
 * Move a task to a specified position in a document
 * @param document The document to modify
 * @param taskToMove The task to move
 * @param position Where to place the task: 'beginning', 'end', 'before', or 'after' (defaults to 'beginning')
 * @param referenceTodoText When position is 'before' or 'after', the text of the reference task for positioning
 * @returns The modified document
 */
export function moveTaskToPosition(
  document: Note, 
  taskToMove: Task, 
  position: "beginning" | "end" | "before" | "after" = "beginning",
  referenceTodoText?: string
): Note {
  // Create a copy to avoid modifying the original
  const newDocument = JSON.parse(JSON.stringify(document)) as Note;

  // Remove the task from its current position
  const documentAfterRemoval = removeTaskFromDocument(newDocument, taskToMove);
  
  // Determine the insertion position based on the positioning parameters
  const index = determineInsertionPosition(documentAfterRemoval, position, referenceTodoText);
  
  // Insert the task at the determined position
  return insertTaskAtPosition(documentAfterRemoval, taskToMove, index);
}
