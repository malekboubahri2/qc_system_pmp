#ifndef LOGINVIEW_HPP
#define LOGINVIEW_HPP

#include <gui_generated/login_screen/loginViewBase.hpp>
#include <gui/login_screen/loginPresenter.hpp>
#include <touchgfx/Callback.hpp>
#include <touchgfx/widgets/AbstractButton.hpp>

class loginView : public loginViewBase
{
public:
    loginView();
    virtual ~loginView() {}
    virtual void setupScreen();
    virtual void tearDownScreen();
    virtual void handleTickEvent();

    /* Called by Presenter. */
    void setDigitCount(int n);
    void showError();
    void gotoProductRefScreen();

private:
    void onKeyClicked(const touchgfx::AbstractButton& src);

    touchgfx::Callback<loginView, const touchgfx::AbstractButton&> m_keyCallback;
    int m_error_ticks;
};

#endif // LOGINVIEW_HPP
