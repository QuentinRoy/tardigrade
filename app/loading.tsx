import { Skeleton, Stack } from "@mantine/core";
import AppPage from "#design-system/AppPage.tsx";

export default function Loading() {
	return (
		<AppPage>
			<Stack gap="md">
				<Skeleton width={260} height={72} />
				{[0, 1, 2].map((i) => (
					<Skeleton key={i} width={180} height={32} />
				))}
			</Stack>
		</AppPage>
	);
}
