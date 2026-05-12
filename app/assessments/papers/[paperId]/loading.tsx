import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";

export default function Loading() {
  return (
    <Container maxWidth="md" sx={{ py: 5 }}>
      <Box component="header" sx={{ pb: 2 }}>
        <Skeleton width={180} height={24} sx={{ mb: 1 }} />
        <Skeleton width="35%" height={54} sx={{ mb: 1 }} />
      </Box>

      <Box sx={{ mb: 4, display: "flex", gap: 1, flexWrap: "wrap" }}>
        <Skeleton variant="rounded" width={152} height={36} />
        <Skeleton variant="rounded" width={132} height={36} />
        <Skeleton width={100} height={20} sx={{ alignSelf: "center", ml: 1 }} />
      </Box>

      {[0, 1, 2].map((questionIndex) => (
        <Box key={questionIndex} sx={{ mb: 4 }}>
          <Skeleton width="40%" height={36} sx={{ mb: 1 }} />
          {[0, 1].map((rubricIndex) => (
            <Box
              key={`${questionIndex}-${rubricIndex}`}
              sx={{ mb: 2, display: "flex", gap: 2, alignItems: "center" }}
            >
              <Skeleton variant="rounded" width={88} height={40} />
              <Skeleton width="74%" height={22} />
              <Skeleton width={24} height={20} />
            </Box>
          ))}
        </Box>
      ))}

      <Box sx={{ mt: 2, textAlign: "center" }}>
        <Skeleton width={72} height={28} sx={{ mx: "auto" }} />
        <Skeleton
          variant="rounded"
          width={280}
          height={8}
          sx={{ mx: "auto", mt: 1, borderRadius: 3 }}
        />
        <Skeleton width={120} height={20} sx={{ mx: "auto", mt: 0.5 }} />
      </Box>
    </Container>
  );
}
