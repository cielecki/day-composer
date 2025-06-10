// Image data interface for UI components (based on existing AttachedImage)

export interface AttachedImage {
	id: string;
	name: string;
	src: string; // base64 data URL (data:image/png;base64,...)
}
