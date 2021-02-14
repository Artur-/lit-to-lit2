import * as fs from "fs";
import { basename } from "path";
import * as ts from "typescript";
import {
  getImportReplacement,
  getSource,
  isImportForIdentifier,
  isImportFrom,
} from "./util";

const litDecorators = [
  "customElement",
  "property",
  "internalProperty",
  "query",
];

const debug = (msg) => {
  if (false) return;
  console.log(msg);
};
interface StartEnd {
  pos: number;
  end: number;
}
interface CodeChange {
  node: StartEnd;
  replacement: string;
}

const tsInput = process.argv[2];
let tsOutput = tsInput.replace(".ts", ".lit2.ts");
if (process.argv.length >= 2 && process.argv[3] == "--replace") {
  tsOutput = tsInput;
}

const originalCode = fs.readFileSync(tsInput, "utf8");

const codeTransformer = (
  source: ts.SourceFile,
  node: ts.Node,
  codeChanges: CodeChange[]
) => {
  if (
    isImportForIdentifier(node, litDecorators) &&
    !isImportFrom(node, "lit/decorators")
  ) {
    const replacement = getImportReplacement(
      node as ts.ImportDeclaration,
      source,
      litDecorators,
      "lit/decorators"
    );
    debug(
      "Rewrite customElement import from " +
        getSource(source, node) +
        "\n to\n" +
        replacement
    );
    codeChanges.push({ node, replacement });
  }
};

const source = ts.createSourceFile(
  basename(tsInput),
  originalCode,
  ts.ScriptTarget.Latest
);

export const transform = (source: ts.SourceFile): string => {
  const codeChanges: CodeChange[] = [];

  const visit = (
    node: ts.Node,
    visitor: {
      (source: ts.SourceFile, node: ts.Node, codeChanges: CodeChange[]): void;
    }
  ) => {
    visitor(source, node, codeChanges);
    node.forEachChild((child) => {
      visit(child, visitor);
    });
  };

  visit(source, codeTransformer);

  const originalCode = source.getFullText();
  let newCode = originalCode;

  // Sort end to start so positions do not change while replacing
  codeChanges.sort((a, b) => {
    return a.node.pos > b.node.pos ? -1 : 1;
  });

  if (debug) {
    console.log(
      codeChanges.map((change) => {
        return {
          from: getSource(source, change.node as ts.Node),
          to: change.replacement,
        };
      })
    );
  }

  codeChanges.forEach((codeChange) => {
    newCode =
      newCode.substring(0, codeChange.node.pos) +
      codeChange.replacement +
      newCode.substring(codeChange.node.end);
  });

  return newCode;
};
const result = transform(source);
fs.writeFileSync(tsOutput, result);
