/**
 * A painting body's key among a Canvas's choices: its Canvas, its annotation (else its
 * place), and the body's place in it. The Canvas keeps the item chosen of a `Choice` by
 * it (`ChoiceSelections`), and an annotation of one of its items (Cookbook 0326) is
 * marked by it, so it is drawn while that item is the one chosen.
 */
export const choiceKey = (
  canvasId: string,
  annotationId: string | undefined,
  page: number,
  index: number,
  body: number,
): string => `${canvasId}|${annotationId ?? `${page}:${index}`}|${body}`;
