import "@fontsource/anonymous-pro";

import { useTheme } from "@material-ui/core/styles";
import React from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import codeStyle from "react-syntax-highlighter/dist/cjs/styles/hljs/atom-one-light";

type CodeSnippetProps = { children: string };
export default function CodeSnippet({
  children,
}: CodeSnippetProps): React.ReactElement {
  const theme = useTheme();
  return (
    <SyntaxHighlighter
      language="javascript"
      style={codeStyle}
      customStyle={{
        fontFamily: "Anonymous Pro",
        padding: theme.spacing(2),
        borderRadius: theme.spacing(1),
      }}
    >
      {children.trim()}
    </SyntaxHighlighter>
  );
}
