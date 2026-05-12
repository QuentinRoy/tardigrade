import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";

export default function Loading() {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ mb: 3 }}>
        <Skeleton width={180} height={24} sx={{ mb: 1 }} />
        <Skeleton width="42%" height={52} sx={{ mb: 1 }} />
        <Skeleton width={140} height={36} />
      </Box>

      <Box sx={{ mb: 4 }}>
        <Skeleton width={170} height={38} sx={{ mb: 1 }} />
        {[0, 1, 2].map((id) => (
          <Skeleton
            key={`paper-${id}`}
            width="100%"
            height={42}
            sx={{ mb: 1 }}
          />
        ))}
      </Box>

      <Box sx={{ mb: 4 }}>
        <Skeleton width={190} height={38} sx={{ mb: 1 }} />
        {[0, 1, 2, 3].map((id) => (
          <Skeleton
            key={`question-${id}`}
            width="100%"
            height={42}
            sx={{ mb: 1 }}
          />
        ))}
      </Box>
    </Container>
  );
}
