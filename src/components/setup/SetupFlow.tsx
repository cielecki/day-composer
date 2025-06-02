import React, { useState, useCallback, useEffect } from 'react';
import { SetupStep, getSetupState } from '../../utils/setup-state';
import { LanguageSelectionScreen } from './LanguageSelectionScreen';
import { CreateStarterKitScreen } from './CreateStarterKitScreen';
import { AnthropicKeyScreen } from './AnthropicKeyScreen';
import { OpenAIKeyScreen } from './OpenAIKeyScreen';
import { useLNMode } from '../../context/LNModeContext';

interface SetupFlowProps {
	onSetupComplete: () => void;
}

export const SetupFlow: React.FC<SetupFlowProps> = ({
	onSetupComplete
}) => {
	const { lnModesRef } = useLNMode();
	const [refreshTrigger, setRefreshTrigger] = useState(0);
	
	// Force refresh of setup state by incrementing trigger
	const refreshSetupState = useCallback(() => {
		setRefreshTrigger(prev => prev + 1);
	}, []);

	// Get current setup state
	const setupState = getSetupState(lnModesRef.current);

	// Periodically check for setup state changes (e.g., API keys configured in settings)
	useEffect(() => {
		const interval = setInterval(() => {
			const currentState = getSetupState(lnModesRef.current);
			
			// If setup is now complete, trigger completion
			if (currentState.currentStep === SetupStep.COMPLETE) {
				onSetupComplete();
				return;
			}
			
			// Otherwise, refresh to show the correct screen
			refreshSetupState();
		}, 2000); // Check every 2 seconds

		return () => clearInterval(interval);
	}, [refreshSetupState, onSetupComplete, lnModesRef]);

	// Also refresh when the component becomes visible (window focus)
	useEffect(() => {
		const handleFocus = () => {
			refreshSetupState();
		};

		window.addEventListener('focus', handleFocus);
		
		return () => {
			window.removeEventListener('focus', handleFocus);
		};
	}, [refreshSetupState]);

	const handleLanguageConfigured = useCallback(() => {
		refreshSetupState();
	}, [refreshSetupState]);

	const handleCreateStarterKit = useCallback(() => {
		if (window.app) {
			// @ts-ignore - Using the Obsidian command API
			window.app.commands.executeCommandById("life-navigator:create-starter-kit");
			
			// Wait a bit for the starter kit to be created, then refresh
			setTimeout(() => {
				refreshSetupState();
			}, 1000);
		}
	}, [refreshSetupState]);

	const handleAnthropicKeyConfigured = useCallback(() => {
		refreshSetupState();
	}, [refreshSetupState]);

	const handleOpenAIKeyConfigured = useCallback(() => {
		onSetupComplete();
	}, [onSetupComplete]);

	const handleOpenAIKeySkipped = useCallback(() => {
		onSetupComplete();
	}, [onSetupComplete]);

	// Render the appropriate screen based on setup state
	switch (setupState.currentStep) {
		case SetupStep.CONFIGURE_LANGUAGE:
			return (
				<LanguageSelectionScreen 
					onLanguageConfigured={handleLanguageConfigured}
				/>
			);

		case SetupStep.CREATE_STARTER_KIT:
			return (
				<CreateStarterKitScreen 
					onCreateStarterKit={handleCreateStarterKit}
				/>
			);

		case SetupStep.CONFIGURE_ANTHROPIC_KEY:
			return (
				<AnthropicKeyScreen 
					onKeyConfigured={handleAnthropicKeyConfigured}
				/>
			);

		case SetupStep.CONFIGURE_OPENAI_KEY:
			return (
				<OpenAIKeyScreen 
					onKeyConfigured={handleOpenAIKeyConfigured}
					onSkip={handleOpenAIKeySkipped}
				/>
			);

		case SetupStep.COMPLETE:
		default:
			// Setup is complete, this component shouldn't be rendered
			return null;
	}
}; 