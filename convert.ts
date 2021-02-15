import { program } from "commander";
import { debug } from "console";
import * as fs from "fs";
import { basename } from "path";
import * as ts from "typescript";
import {
  setDebug,
  getImportReplacement,
  getSource,
  isImportForIdentifier,
  isImportFrom,
  replaceIfDecorator,
} from "./util";

const litDecorators = {
  customElement: "customElement",
  property: "property",
  internalProperty: "state",
  query: "query",
};

interface StartEnd {
  pos: number;
  end: number;
}
export interface CodeChange {
  node: StartEnd;
  replacement: string;
}

const codeTransformer = (
  source: ts.SourceFile,
  node: ts.Node,
  codeChanges: CodeChange[]
) => {
  if (
    isImportForIdentifier(node, Object.keys(litDecorators)) &&
    !isImportFrom(node, "lit/decorators")
  ) {
    const replacement = getImportReplacement(
      node as ts.ImportDeclaration,
      source,
      litDecorators,
      "lit/decorators"
    );
    debug(
      "Rewrite decorator import from " +
        getSource(source, node) +
        "\n to\n" +
        replacement
    );
    codeChanges.push({ node, replacement });
  }
  replaceIfDecorator(node, "internalProperty", "state", codeChanges);
};

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

  debug(
    codeChanges.map((change) => {
      return {
        from: getSource(source, change.node as ts.Node),
        to: change.replacement,
      };
    })
  );

  codeChanges.forEach((codeChange) => {
    newCode =
      newCode.substring(0, codeChange.node.pos) +
      codeChange.replacement +
      newCode.substring(codeChange.node.end);
  });

  return newCode;
};

program
  .option("--replace", "Replace the input file with the new version")
  .option("--debug", "Enable debug output")
  .arguments("<inputFile>")
  .action((tsInput) => {
    let tsOutput = tsInput.replace(".ts", ".lit2.ts");
    const conf = program as any;

    if (conf.replace) {
      tsOutput = tsInput;
    }
    if (conf.debug) {
      setDebug(true);
    }
    const originalCode = fs.readFileSync(tsInput, "utf8");
    const source = ts.createSourceFile(
      basename(tsInput),
      originalCode,
      ts.ScriptTarget.Latest
    );

    const result = transform(source);
    fs.writeFileSync(tsOutput, result);
    console.log(`Template '${tsInput}' converted and written to '${tsOutput}'`);
  });

program.parse(process.argv);
