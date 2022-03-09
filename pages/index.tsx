import Container from "@mui/material/Container";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import Typography from "@mui/material/Typography";
import makeStyles from "@mui/styles/makeStyles";
import { GetStaticProps, InferGetStaticPropsType } from "next";
import React from "react";

import Link from "../src/Link";
import loadQuestions from "../src/loadQuestions";

function ListItemLink(props) {
  return <ListItem component={Link} {...props} />;
}

const useStyles = makeStyles((theme) => ({
  main: { padding: theme.spacing(8, 0) },
}));

export default function Index({
  questions,
}: InferGetStaticPropsType<typeof getStaticProps>): React.ReactElement {
  const classes = useStyles();

  let qLinks = questions.map(({ id, label }) => (
    <ListItemLink button key={id} href={`/${id}`}>
      {label == null ? id : label}
    </ListItemLink>
  ));
  return (
    <Container component="main" maxWidth="sm" className={classes.main}>
      <Typography variant="h3" component="h1" gutterBottom>
        Grading Grid
      </Typography>
      <List component="nav">{qLinks}</List>
    </Container>
  );
}

export const getStaticProps: GetStaticProps = async () => {
  const grid = await loadQuestions();
  return {
    props: {
      questions: Object.entries(grid).map(([id, { label }]) =>
        label == null ? { id } : { id, label },
      ),
    },
  };
};
