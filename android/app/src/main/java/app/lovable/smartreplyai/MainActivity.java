package app.lovable.smartreplyai;

import android.content.Intent;
import android.os.Bundle;
import android.webkit.WebView;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private String pendingSharedText = null;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        handleSendIntent(getIntent(), false);
        // Try delivering once the WebView is ready
        deliverPendingShared(1500);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleSendIntent(intent, true);
    }

    private void handleSendIntent(Intent intent, boolean deliverImmediately) {
        if (intent == null) return;
        String action = intent.getAction();
        String type = intent.getType();
        if (Intent.ACTION_SEND.equals(action) && type != null && type.startsWith("text/")) {
            CharSequence shared = intent.getCharSequenceExtra(Intent.EXTRA_TEXT);
            if (shared != null && shared.length() > 0) {
                pendingSharedText = shared.toString();
                if (deliverImmediately) {
                    deliverPendingShared(200);
                }
            }
        }
    }

    private void deliverPendingShared(long delayMs) {
        if (pendingSharedText == null) return;
        final String text = pendingSharedText;
        if (getBridge() == null || getBridge().getWebView() == null) return;
        final WebView wv = getBridge().getWebView();
        wv.postDelayed(() -> {
            String escaped = jsonEscape(text);
            String js =
                "(function(){" +
                "  var t = \"" + escaped + "\";" +
                "  window.__sharedText = t;" +
                "  try { window.dispatchEvent(new CustomEvent('smartreply:shared', { detail: t })); } catch(e){}" +
                "  try {" +
                "    var u = new URL(window.location.href);" +
                "    if (!u.pathname.startsWith('/app/generate')) {" +
                "      window.location.replace('/app/generate?shared=' + encodeURIComponent(t));" +
                "    }" +
                "  } catch(e){}" +
                "})();";
            wv.evaluateJavascript(js, null);
            pendingSharedText = null;
        }, delayMs);
    }

    private static String jsonEscape(String s) {
        StringBuilder sb = new StringBuilder(s.length() + 16);
        for (int i = 0; i < s.length(); i++) {
            char c = s.charAt(i);
            switch (c) {
                case '\\': sb.append("\\\\"); break;
                case '"': sb.append("\\\""); break;
                case '\n': sb.append("\\n"); break;
                case '\r': sb.append("\\r"); break;
                case '\t': sb.append("\\t"); break;
                default:
                    if (c < 0x20) sb.append(String.format("\\u%04x", (int) c));
                    else sb.append(c);
            }
        }
        return sb.toString();
    }
}
