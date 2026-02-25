import javax.swing.JFrame;
import java.awt.Font;
import java.awt.Color;
import java.awt.Dimension;
import javax.swing.JPanel;
import javax.swing.JLabel;
import javax.swing.SwingConstants;
import javax.swing.JTextField;
import javax.swing.JButton;
import java.awt.event.ActionListener;
import java.awt.event.ActionEvent;
import javax.swing.ImageIcon;
import java.awt.event.KeyAdapter;
import java.awt.event.KeyEvent;

public class GuessingGame extends JFrame {
	private JTextField txtGuess;
	private JButton btnPlayAgain;
	private JLabel lblOutput;
	private int theNumber;
	private int numberOfTries = 0;
	
	public void checkGuess(){
		String guessText = txtGuess.getText();
		String message = "";
		try {
		    int guess = Integer.parseInt(guessText);
			numberOfTries++;
		    if (guess < theNumber)
			    message = guess + " is too low. Try again.";
		    else if (guess > theNumber)
			    message = guess + " is too high. Try again.";
		    else {
			    message = guess + " is correct. You win!";
			    btnPlayAgain.setVisible(true);
		 }
	 } catch (Exception e) {
		 message = "Enter a whole number between -100 and 100.";
	 } finally {
		 lblOutput.setText(message);
		 txtGuess.requestFocus();
		 txtGuess.selectAll();
	 }
	 
	}

	public void newGame() {
		theNumber = (int) (Math.random() * 200) - 100;
		numberOfTries = 0; 
		btnPlayAgain.setVisible(false);
		lblOutput.setText("Enter a number above and click Guess!");
		txtGuess.setText("");
		txtGuess.requestFocus();
	}

	public GuessingGame() {
		getContentPane().setForeground(new Color(192, 192, 192));
		setFont(new Font("Tahoma", Font.BOLD, 15));
		setTitle("Dr.Muhammad Hi-Lo Guessing Game");
		getContentPane().setLayout(null);
		
		JLabel lblNewLabel = new JLabel("Dr.Muhammad's Hi-Lo Guessing Game");
		lblNewLabel.setHorizontalAlignment(SwingConstants.CENTER);
		lblNewLabel.setFont(new Font("Tahoma", Font.BOLD, 15));
		lblNewLabel.setBounds(10, 11, 414, 24);
		getContentPane().add(lblNewLabel);
		
		JLabel lblNewLabel_1 = new JLabel("Guess a number between -100 and 100:");
		lblNewLabel_1.setHorizontalAlignment(SwingConstants.RIGHT);
		lblNewLabel_1.setBounds(10, 72, 272, 14);
		getContentPane().add(lblNewLabel_1);
		
		txtGuess = new JTextField();
		txtGuess.setHorizontalAlignment(SwingConstants.CENTER);
		txtGuess.setBounds(292, 69, 43, 20);
		getContentPane().add(txtGuess);
		txtGuess.setColumns(10);

		//Add key listener for Enter key
	    txtGuess.addKeyListener(new KeyAdapter() {
            @Override
            public void keyPressed(KeyEvent e) {
                if (e.getKeyCode() == KeyEvent.VK_ENTER) {
                    checkGuess();
				}
			}
		});
		
		JButton btnGuess = new JButton("Guess");
		btnGuess.setForeground(new Color(0, 0, 0));
		btnGuess.setBackground(new Color(128, 255, 255));
		btnGuess.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				checkGuess();
			}
		});
		btnGuess.setBounds(172, 153, 89, 18);
		getContentPane().add(btnGuess);
		
	    btnPlayAgain = new JButton("");
	    btnPlayAgain.setForeground(new Color(238, 238, 238));
	    btnPlayAgain.setBackground(new Color(255, 255, 255));
	    btnPlayAgain.setIcon(new ImageIcon("D:\\OneDrive\\Изображения\\reload.png"));
		btnPlayAgain.addActionListener(new ActionListener() {
			public void actionPerformed(ActionEvent e) {
				newGame();
			}
		
		});
		btnPlayAgain.setVisible(false);
		btnPlayAgain.setBounds(361, 153, 50, 26);
		getContentPane().add(btnPlayAgain);
		
		
	    lblOutput = new JLabel("Enter a number above and click Guess!");
		lblOutput.setFont(new Font("Tahoma", Font.BOLD, 11));
		lblOutput.setHorizontalAlignment(SwingConstants.CENTER);
		lblOutput.setBounds(10, 209, 414, 14);
		getContentPane().add(lblOutput);
	}
	
	public static void main(String[] args) {
		// TODO Auto-generated method stub
		GuessingGame theGame = new GuessingGame();
		theGame.newGame();
		theGame.setSize(new Dimension(450,300));
		theGame.setVisible(true);

	}
}
