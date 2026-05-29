import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Skeleton from "@mui/material/Skeleton";

export default function Loading() {
	return (
		<Container maxWidth="md" sx={{ py: 5 }}>
			<Skeleton width={260} height={72} />
			{[0, 1, 2].map((i) => (
				<Box key={i} sx={{ my: 2 }}>
					<Skeleton width={180} height={32} />
				</Box>
			))}
		</Container>
	);
}
