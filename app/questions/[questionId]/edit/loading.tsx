import { Container, Skeleton, Stack } from "@mui/material";

export default function EditQuestionLoading() {
  return (
    <Container component="main" maxWidth="md" sx={{ py: 5 }}>
      <Stack spacing={2}>
        <Skeleton variant="text" width={280} height={48} />
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={56} />
        <Skeleton variant="rounded" width="100%" height={280} />
      </Stack>
    </Container>
  );
}
