import { Container, Skeleton, Stack } from "@mui/material";

export default function QuestionsLoading() {
  return (
    <Container component="main" maxWidth="xl" sx={{ py: 5 }}>
      <Stack spacing={2}>
        <Skeleton variant="text" width={360} height={56} />
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={280} />
      </Stack>
    </Container>
  );
}
