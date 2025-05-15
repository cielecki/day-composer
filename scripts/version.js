#!/usr/bin/env node

const fs = require('fs');
const { execSync } = require('child_process');
const path = require('path');

// Function to bump the last number of version
function bumpVersion(version) {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
}

// Get current version from package.json
const packageJsonPath = path.join(__dirname, '..', 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// Get version from command line argument or bump current version
let newVersion = process.argv[2];
if (!newVersion) {
    newVersion = bumpVersion(currentVersion);
    console.log(`No version specified. Bumping current version ${currentVersion} to ${newVersion}`);
}

// Validate version format (simple check)
if (!/^\d+\.\d+\.\d+$/.test(newVersion)) {
    console.error('Version must be in format: x.y.z');
    process.exit(1);
}

try {
    // Update package.json
    packageJson.version = newVersion;
    fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2) + '\n');

    // Update manifest.json
    const manifestJsonPath = path.join(__dirname, '..', 'manifest.json');
    const manifestJson = JSON.parse(fs.readFileSync(manifestJsonPath, 'utf8'));
    manifestJson.version = newVersion;
    fs.writeFileSync(manifestJsonPath, JSON.stringify(manifestJson, null, 2) + '\n');

    // Commit changes
    const commitMessage = `chore: bump version to ${newVersion}`;
    execSync('git add package.json manifest.json', { stdio: 'inherit' });
    execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });

    // Create and push tag
    execSync(`git tag -a ${newVersion} -m "Version ${newVersion}"`, { stdio: 'inherit' });
    execSync('git push --follow-tags', { stdio: 'inherit' });

    console.log(`Successfully updated version to ${newVersion}`);
    console.log('Changes committed and tagged');
} catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
} 