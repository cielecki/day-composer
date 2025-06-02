import React, { useEffect, useState, useCallback } from 'react';
import { SetupStep, getSetupState } from '../../utils/setup-state';
import { LanguageSelectionScreen } from './LanguageSelectionScreen';
import { AnthropicKeyScreen } from './AnthropicKeyScreen';
import { OpenAIKeyScreen } from './OpenAIKeyScreen';
import { t } from '../../i18n';

interface SetupFlowProps {
	lnModes: Record<string, any>;
	onSetupComplete: () => void;
}

export const SetupFlow: React.FC<SetupFlowProps> = ({ lnModes, onSetupComplete }) => {
	const [setupState, setSetupState] = useState(() => getSetupState());
	const [isRefreshing, setIsRefreshing] = useState(false);

	// Refresh setup state
	const refreshSetupState = useCallback(() => {
		const newState = getSetupState();
		setSetupState(newState);
		
		if (newState.currentStep === SetupStep.COMPLETE) {
			onSetupComplete();
		}
	}, [onSetupComplete]);

	// Handle step completion and refresh
	const handleStepComplete = useCallback(() => {
		setIsRefreshing(true);
		setTimeout(() => {
			refreshSetupState();
			setIsRefreshing(false);
		}, 100); // Small delay to allow state updates to propagate
	}, [refreshSetupState]);

	// Effect to check if setup is complete on mount
	useEffect(() => {
		if (setupState.currentStep === SetupStep.COMPLETE) {
			onSetupComplete();
		}
	}, [setupState.currentStep, onSetupComplete]);

	// Show loading state during refresh
	if (isRefreshing) {
		return (
			<div style={{ 
				display: 'flex', 
				alignItems: 'center', 
				justifyContent: 'center', 
				height: '200px',
				color: 'var(--text-muted)'
			}}>
				{t('ui.setup.saving')}...
			</div>
		);
	}

	switch (setupState.currentStep) {
		case SetupStep.CONFIGURE_LANGUAGE:
			return (
				<LanguageSelectionScreen
					onLanguageConfigured={handleStepComplete}
				/>
			);

		case SetupStep.CONFIGURE_ANTHROPIC_KEY:
			return (
				<AnthropicKeyScreen
					onKeyConfigured={handleStepComplete}
				/>
			);

		case SetupStep.CONFIGURE_OPENAI_KEY:
			return (
				<OpenAIKeyScreen
					onKeyConfigured={handleStepComplete}
					onSkip={handleStepComplete}
				/>
			);

		default:
			// This shouldn't happen if setup is working correctly
			return (
				<div style={{ 
					textAlign: 'center', 
					color: 'var(--text-muted)',
					padding: '20px'
				}}>
					Setup complete! Welcome to Life Navigator.
				</div>
			);
	}
}; 