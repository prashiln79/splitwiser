# User Flows & Journey Maps: Splitwiser

This document maps out the critical user journeys through the application, including screen sequences, user actions, state changes, error boundaries, and edge cases.

---

## 1. Authentication & Onboarding Flow

```mermaid
flowchart TD
    Launch[App Launch] --> CheckAuth{User Logged In?}
    CheckAuth -- Yes --> Home[Home Screen: Groups Tab]
    CheckAuth -- No --> Onboarding[Onboarding Screen]
    
    Onboarding --> GuestChoice[Continue as Guest]
    Onboarding --> GoogleChoice[Sign in with Google]
    
    GuestChoice --> CreateAnon[Firebase signInAnonymously]
    CreateAnon --> SaveLocalUser[Create local_users SQLite record]
    SaveLocalUser --> Home
    
    GoogleChoice --> GoogleOAuth[Google Play Services OAuth Sheet]
    GoogleOAuth -- Success --> LinkCheck{Existing Guest Session?}
    LinkCheck -- Yes --> LinkAccount[linkWithCredential]
    LinkCheck -- No --> SignInGoogle[signInWithCredential]
    LinkAccount --> SyncGooglePhoto[Sync Google photo & migrate data]
    SignInGoogle --> SyncGooglePhoto
    SyncGooglePhoto --> Home
```

### Edge Cases
- **Google Play Services Missing**: Handled cleanly with an error alert prompting the user to continue as a guest.
- **Account Linking Conflict**: If the Google account is already registered to a different UID, anonymous data is gracefully merged into the existing Firestore profile without wiping either record.

---

## 2. Profile Picture Management Flow

```mermaid
flowchart TD
    AccountTab[Account Screen / Edit Profile Screen] --> TapAvatar[Tap Avatar / Change Picture]
    TapAvatar --> OpenModal[Open ProfilePhotoModal]
    
    OpenModal --> ActionChoice{Select Action}
    
    ActionChoice -- Gallery --> PickGallery[ImagePicker.launchImageLibraryAsync]
    PickGallery --> CropSquare[Aspect 1:1 Crop]
    CropSquare --> Compress[compressAvatarPhoto: 400x400 JPEG]
    Compress --> UploadStorage[Upload to Firebase Storage]
    UploadStorage --> UpdateUserDoc[Update Firestore: customPhotoUrl, photoSource='custom']
    UpdateUserDoc --> PropagateAvatars[Propagate to SQLite & group members]
    
    ActionChoice -- Camera --> OpenCam[ImagePicker.launchCameraAsync]
    OpenCam --> CropSquare
    
    ActionChoice -- Use Google --> ResetToGoogle[Update Firestore: photoSource='google']
    ResetToGoogle --> PropagateAvatars
    
    ActionChoice -- Remove Picture --> ClearAvatar[Update Firestore: photoSource='none', customPhotoUrl=null]
    ClearAvatar --> FallbackInitials[Fall back to Initials or Google Photo]
```

### Critical Invariants
- When a user uploads a custom photo, `photoSource` is set to `'custom'`. Subsequent Google authentication refreshes will **never** overwrite `customPhotoUrl` or revert `photoSource` to `'google'`.

---

## 3. Expense Creation & Splitting Flow

```mermaid
flowchart TD
    GroupView[Group Details Screen] --> TapFAB[Tap + Add Expense FAB]
    TapFAB --> AddExpenseScreen[Add Expense Screen]
    
    AddExpenseScreen --> EnterDesc[Type Description]
    EnterDesc --> NLPDetect[Real-Time Category NLP Engine]
    NLPDetect --> CategorySet[Category Icon & Tag Updated]
    
    AddExpenseScreen --> EnterAmount[Enter Amount via Numeric Keypad]
    
    AddExpenseScreen --> PayerConfig[Tap 'Paid by' Selector]
    PayerConfig --> SingleMultiChoice{Payer Mode}
    SingleMultiChoice -- Single Payer --> SelectMember[Select Single Member]
    SingleMultiChoice -- Multiple Payers --> EnterPayerContribs[Enter Individual Amounts]
    EnterPayerContribs --> ValidatePayers{Sum == Total?}
    ValidatePayers -- No --> ErrorBanner[Show Error: Sum must equal total]
    ValidatePayers -- Yes --> PayerConfirm[Confirm Multi-Payer]
    
    AddExpenseScreen --> SplitConfig[Tap 'Split Type' Selector]
    SplitConfig --> SplitChoice{Select Mode}
    SplitChoice -- Equal --> DistributeEqual[distributeCentsEqually with remainder resolution]
    SplitChoice -- Unequal --> DistributeUnequal[Custom exact amounts per person]
    SplitChoice -- Percentage --> DistributePct[Percentages summing to 100%]
    SplitChoice -- Shares --> DistributeShares[Multiplier shares]
    SplitChoice -- Adjustment --> DistributeAdj[Equal base +/- adjustments netting to 0]
    SplitChoice -- Itemized --> DistributeItemized[Itemized bill with proportional tax/tip]
    
    AddExpenseScreen --> TapSave[Tap Checkmark / Save Expense]
    TapSave --> SaveLocal[Save to local_expenses in SQLite]
    SaveLocal --> EnqueueSync[Enqueue in sync_queue]
    EnqueueSync --> RecalcBalances[Recalculate Group Balances immediately]
    RecalcBalances --> CloseScreen[Navigate back to Group Details]
```

---

## 4. Group Settlement ("Settle Up") Flow

```mermaid
flowchart TD
    GroupDetails[Group Details Screen] --> ViewBalances[View Member Net Balances]
    ViewBalances --> TapSettle[Tap 'Settle Up' on Debtor/Creditor Card]
    TapSettle --> SettleModal[Open SettleUpModal]
    
    SettleModal --> PrePopulate[Pre-populates suggested settlement amount]
    SettleModal --> EditAmount[Optionally edit amount for partial payment]
    SettleModal --> TapRecord[Tap 'Record Payment']
    
    TapRecord --> WriteLocalSettlement[Insert into local_settlements in SQLite]
    WriteLocalSettlement --> QueueSettlementSync[Enqueue mutation in sync_queue]
    QueueSettlementSync --> UpdateNetBalances[Update Net Balances: Debtor debt reduced, Creditor credit reduced]
    UpdateNetBalances --> DismissModal[Close Modal & Haptic Success Feedback]
```

---

## 5. Group Cover Photo Customization Flow

```mermaid
flowchart TD
    GroupDetails[Group Details Screen] --> TapCoverCamera[Tap Camera Button on Cover Banner]
    TapCoverCamera --> OpenCoverModal[Open GroupCoverPhotoModal]
    
    OpenCoverModal --> SegmentChoice{Select Tab}
    
    SegmentChoice -- Presets --> ViewPresets[Browse 29 Curated Covers by Category]
    ViewPresets --> SelectPreset[Tap Preset Thumbnail]
    SelectPreset --> UpdateCoverDoc[Update Firestore & SQLite: type='preset', imageUrl, presetId]
    
    SegmentChoice -- Custom --> PickGalleryImage[ImagePicker.launchImageLibraryAsync with 16:9 crop]
    PickGalleryImage --> CompressBanner[compressCoverPhoto to 1280x720 JPEG]
    CompressBanner --> UploadCover[Upload to Firebase Storage: groups/{groupId}/covers/...]
    UploadCover --> UpdateCoverDocCustom[Update Firestore & SQLite: type='custom', imageUrl]
    
    UpdateCoverDoc --> SmoothUpdate[GroupCoverHeader updates smoothly without page jump]
    UpdateCoverDocCustom --> SmoothUpdate
```

---

## 6. Group Data Export Flow

```mermaid
flowchart TD
    GroupSettings[Group Settings Screen] --> TapExport[Tap 'Export Group Data']
    TapExport --> OpenExportModal[Open GroupExportModal]
    
    OpenExportModal --> SelectRange{Select Date Range}
    SelectRange -- All Time --> AllExpenses[Load all non-deleted expenses & settlements]
    SelectRange -- Date Range --> FilteredExpenses[Filter items by startDate and endDate]
    
    OpenExportModal --> FormatChoice{Choose Format}
    FormatChoice -- CSV Spreadsheet --> GenCsv[generateGroupCsv per RFC-4180]
    GenCsv --> ShareCsv[Open System Share Sheet for .csv file]
    
    FormatChoice -- Text Summary --> GenText[generateGroupSummary formatted string]
    GenText --> CopyText[Copy to Clipboard or Share to WhatsApp/SMS]
```

