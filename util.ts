import * as ts from "typescript";

export const isImportForIdentifier = (node: ts.Node, identifiers: string[]) => {
  if (!ts.isImportDeclaration(node)) {
    return false;
  }
  const importDeclaration = node as ts.ImportDeclaration;
  let matched = false;
  const importNode = importDeclaration.importClause;
  if (!importNode) {
    // Imports like "import '@vaadin/vaadin-button'"
    return false;
  }
  if (importNode.namedBindings) {
    if (ts.isNamedImports(importNode.namedBindings)) {
      const namedImports = importNode.namedBindings as ts.NamedImports;
      namedImports.elements.forEach((element) => {
        const importedIdentifier = element.name.text;
        if (identifiers.includes(importedIdentifier)) {
          matched = true;
        }
      });
    } else if (ts.isNamespaceImport(importNode.namedBindings)) {
      const namespaceImport = importNode.namedBindings as ts.NamespaceImport;
      if (identifiers.includes(namespaceImport.name.text)) {
        matched = true;
      }
    }
  } else if (importNode.name && identifiers.includes(importNode.name.text)) {
    matched = true;
  }
  return matched;
};

export const isImportFrom = (
  node: ts.Node,
  locationPrefix: string
): boolean => {
  if (!ts.isImportDeclaration(node)) {
    return false;
  }
  const importDeclaration = node as ts.ImportDeclaration;
  return (importDeclaration.moduleSpecifier as ts.StringLiteral).text.startsWith(
    locationPrefix
  );
};
export const getSource = (source: ts.SourceFile, node: ts.Node): string => {
  return source.getFullText().substring(node.pos, node.end);
};

export const getImportReplacement = (
  node: ts.ImportDeclaration,
  source: ts.SourceFile,
  exclude: string[],
  importExcludedFrom: String
) => {
  const importNode = node.importClause;

  if (importNode && importNode.namedBindings) {
    if (ts.isNamedImports(importNode.namedBindings)) {
      const namedImports = importNode.namedBindings;
      const importedIdentifiers = namedImports.elements.map(
        (element) => element.name.text
      );
      const removedIdentifiers = importedIdentifiers.filter((id) =>
        exclude.includes(id)
      );
      const retainedIdentifiers = importedIdentifiers.filter(
        (id) => !exclude.includes(id)
      );
      let replacementForCurrent = "";
      if (retainedIdentifiers.length > 0) {
        replacementForCurrent = getSource(source, node).replace(
          /{.*}/,
          `{ ${retainedIdentifiers.join(", ")} }`
        );
      }

      return (
        replacementForCurrent +
        `\nimport { ${removedIdentifiers.join(
          ", "
        )} } from '${importExcludedFrom}';`
      );
    }
    // } else if (importNode.name && exclude.includes(importNode.name.text)) {
    //   matched = true;
  }
  return getSource(source, node);
};
