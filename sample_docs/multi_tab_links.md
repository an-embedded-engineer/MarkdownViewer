# Multi-tab Link Navigation Sample

この文書は、relative Markdown linkのmulti-tab動作を確認するための入口である。

## 確認手順

1. Explorerから`multi_tab_link_target.md`を開く。
2. この`multi_tab_links.md`へ戻り、次のlinkを選択する。
3. targetの既存tabが再利用され、`Anchor Destination`へscrollすることを確認する。
4. target tabをcloseし、この文書へ戻って同じlinkを選択する。
5. targetが新しいtabで開かれ、同じanchorへscrollすることを確認する。

[Open or activate the target anchor](multi_tab_link_target.md#anchor-destination)

## 同一文書anchor

[Jump to the local anchor](#local-anchor)

### Spacer 1

Relative link navigation should keep the source tab open.

### Spacer 2

The target path must not create duplicate tabs.

### Spacer 3

Closing the target and following the link again should create a new tab.

## Local Anchor

同一文書内のanchor linkは、新しいtabを作らずこの位置へscrollする。
