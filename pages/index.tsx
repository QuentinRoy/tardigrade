import Container from "@material-ui/core/Container";
import List from "@material-ui/core/List";
import ListItem from "@material-ui/core/ListItem";
import { makeStyles } from "@material-ui/core/styles";
import Typography from "@material-ui/core/Typography";
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
    <ListItemLink button naked key={id} href={`/questions/${id}`}>
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
