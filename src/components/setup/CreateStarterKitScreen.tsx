import React from 'react';
import { t } from '../../i18n';
import { LucideIcon } from '../LucideIcon';

interface CreateStarterKitScreenProps {
	onCreateStarterKit: () => void;
}

export const CreateStarterKitScreen: React.FC<CreateStarterKitScreenProps> = ({
	onCreateStarterKit
}) => {
	return (
		<div className="setup-screen">
			<div className="setup-content">
				<div className="setup-icon">
					<LucideIcon name="rocket" size={64} color="var(--interactive-accent)" />
				</div>
				
				<h2 className="setup-title">
					{t('ui.setup.starterKit.title')}
				</h2>
				
				<p className="setup-description">
					{t('ui.setup.starterKit.description')}
				</p>
				
				<div className="setup-features">
					<div className="setup-feature">
						<span className="setup-feature-icon">🎭</span>
						<span>{t('ui.setup.starterKit.features.modes')}</span>
					</div>
					<div className="setup-feature">
						<span className="setup-feature-icon">📋</span>
						<span>{t('ui.setup.starterKit.features.templates')}</span>
					</div>
					<div className="setup-feature">
						<span className="setup-feature-icon">🎯</span>
						<span>{t('ui.setup.starterKit.features.examples')}</span>
					</div>
				</div>
				
				<button 
					className="mod-cta setup-button"
					onClick={onCreateStarterKit}
				>
					{t('ui.setup.starterKit.button')}
				</button>
			</div>
		</div>
	);
}; 