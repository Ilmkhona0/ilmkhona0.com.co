import javax.swing.JButton;
import javax.swing.JFrame;
import javax.swing.JTextArea;
import javax.swing.JTextField;
import javax.swing.JLabel;
import javax.swing.JSlider;
import javax.swing.JOptionPane;
import javax.swing.event.ChangeListener;
import javax.swing.event.ChangeEvent;
import java.awt.event.ActionListener;
import java.awt.Dimension;
import java.awt.event.ActionEvent;

public class SecretMessages extends JFrame {
    private JTextField txtKey;
    private JTextArea txtIn;
    private JTextArea txtOut;
    private JSlider slider;

    public SecretMessages() {
        setTitle("Secret Messages App");
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        getContentPane().setLayout(null);

        txtIn = new JTextArea();
        txtIn.setBounds(10, 11, 564, 140);
        getContentPane().add(txtIn);

        txtOut = new JTextArea();
        txtOut.setBounds(10, 210, 564, 140);
        getContentPane().add(txtOut);

        txtKey = new JTextField();
        txtKey.setBounds(258, 173, 44, 20);
        getContentPane().add(txtKey);

        JLabel lblKey = new JLabel("Key:");
        lblKey.setBounds(202, 176, 46, 14);
        getContentPane().add(lblKey);

        slider = new JSlider(0, 25, 0);
        slider.setBounds(10, 170, 150, 45);
        slider.addChangeListener(new ChangeListener() {
            public void stateChanged(ChangeEvent e) {
                txtKey.setText("" + slider.getValue());
                String message = txtIn.getText();
                int key = slider.getValue();
                String output = encode(message, key);
                txtOut.setText(output);
            }
        });
        getContentPane().add(slider);

        JButton btnEncodeDecode = new JButton("Encode/Decode");
        btnEncodeDecode.addActionListener(new ActionListener() {
            public void actionPerformed(ActionEvent arg0) {
                try {
                    String message = txtIn.getText();
                    int key = Integer.parseInt(txtKey.getText());
                    String output = encode(message, key);
                    txtOut.setText(output);
                } catch (Exception ex) {
                    JOptionPane.showMessageDialog(null, "Please enter a whole number value for the encryption key.");
                    txtKey.requestFocus();
                    txtKey.selectAll();
                }
            }
        });
        btnEncodeDecode.setBounds(312, 172, 144, 23);
        getContentPane().add(btnEncodeDecode);
    }

    public String encode(String message, int keyVal) {
        StringBuilder output = new StringBuilder();
        char key = (char) keyVal;

        for (int x = 0; x < message.length(); x++) {
            char input = message.charAt(x);

            if (input >= 'A' && input <= 'Z') {
                input += key;
                if (input > 'Z') input -= 26;
                if (input < 'A') input += 26;
            } else if (input >= 'a' && input <= 'z') {
                input += key;
                if (input > 'z') input -= 26;
                if (input < 'a') input += 26;
            } else {
                output.append(input);
                continue;
            }

            output.append(input);
        }

        return output.toString();
    }

    public static void main(String[] args) {
        SecretMessages theApp = new SecretMessages();
        theApp.setSize(new Dimension(600, 400));
        theApp.setVisible(true);
    }
}
